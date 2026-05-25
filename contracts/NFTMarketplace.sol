// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC721URIStorage} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";

contract NFTMarketplace is ERC721URIStorage, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    enum MatchState {
        Draft,
        Open,
        Resolved,
        Cancelled
    }

    struct MatchConfig {
        uint256 id;
        uint256 entryPrice;
        uint256 rewardAmount;
        uint256 opensAt;
        uint256 closesAt;
        uint256 totalMints;
        uint256 winningMints;
        uint8 winningOption;
        MatchState state;
        bool exists;
        string slug;
        string title;
        string description;
        string imageUri;
        string rewardAssetSymbol;
        string metadataUri;
        string[] options;
    }

    struct MintedPrediction {
        uint256 tokenId;
        uint8 selectedOption;
        bool claimed;
        bool exists;
    }

    struct MatchSummary {
        uint256 id;
        uint256 entryPrice;
        uint256 rewardAmount;
        uint256 opensAt;
        uint256 closesAt;
        uint256 totalMints;
        uint256 winningMints;
        uint8 winningOption;
        MatchState state;
        bool exists;
        string slug;
        string title;
        string description;
        string imageUri;
        string rewardAssetSymbol;
        string metadataUri;
        string[] options;
    }

    IERC20 public immutable quoteToken;
    uint256 public nextMatchId = 1;
    uint256 public nextTokenId = 1;

    mapping(uint256 => MatchConfig) private _matches;
    mapping(string => uint256) private _slugToMatchId;
    mapping(uint256 => mapping(address => MintedPrediction)) private _predictionsByMatchAndUser;
    mapping(uint256 => MintedPrediction) private _predictionsByTokenId;
    mapping(uint256 => uint256) private _tokenToMatchId;
    mapping(uint256 => mapping(uint8 => uint256)) private _optionMintCounts;

    event MatchCreated(
        uint256 indexed matchId,
        string slug,
        string title,
        uint256 entryPrice,
        uint256 rewardAmount,
        uint256 opensAt,
        uint256 closesAt
    );
    event MatchOpened(uint256 indexed matchId);
    event MatchCancelled(uint256 indexed matchId);
    event MatchMinted(
        address indexed participant,
        uint256 indexed matchId,
        uint256 indexed tokenId,
        uint8 selectedOption,
        uint256 entryPrice
    );
    event MatchResolved(uint256 indexed matchId, uint8 indexed winningOption, uint256 winningMints);
    event RewardClaimed(
        address indexed participant,
        uint256 indexed matchId,
        uint256 indexed tokenId,
        uint256 rewardAmount,
        bool winner
    );
    event RewardPoolFunded(uint256 amount);
    event RewardPoolWithdrawn(address indexed recipient, uint256 amount);

    error ZeroAddress();
    error EmptyString();
    error InvalidOptions();
    error InvalidTimestampWindow();
    error MatchNotFound();
    error DuplicateSlug();
    error MatchNotJoinable();
    error MatchNotResolvable();
    error MatchNotClaimable();
    error InvalidOption();
    error AlreadyMinted();
    error PredictionNotFound();
    error PredictionAlreadyClaimed();
    error NotWinner();
    error InsufficientRewardLiquidity();
    error TransferDisabled();

    constructor(address quoteToken_) ERC721("XCup Prediction Market", "XPRED") Ownable(msg.sender) {
        if (quoteToken_ == address(0)) revert ZeroAddress();
        quoteToken = IERC20(quoteToken_);
    }

    function createMatch(
        string calldata slug,
        string calldata title,
        string calldata description,
        string calldata imageUri,
        string calldata rewardAssetSymbol,
        string calldata metadataUri,
        string[] calldata options,
        uint256 entryPrice,
        uint256 rewardAmount,
        uint256 opensAt,
        uint256 closesAt,
        bool openImmediately
    ) external onlyOwner returns (uint256 matchId) {
        if (bytes(slug).length == 0) revert EmptyString();
        if (bytes(title).length == 0) revert EmptyString();
        if (bytes(description).length == 0) revert EmptyString();
        if (bytes(rewardAssetSymbol).length == 0) revert EmptyString();
        if (bytes(metadataUri).length == 0) revert EmptyString();
        if (options.length < 2) revert InvalidOptions();
        if (entryPrice == 0 || rewardAmount == 0) revert InvalidOptions();
        if (_slugToMatchId[slug] != 0) revert DuplicateSlug();
        if (opensAt == 0 || closesAt == 0) revert InvalidTimestampWindow();
        if (closesAt <= opensAt) revert InvalidTimestampWindow();
        if (openImmediately && opensAt > block.timestamp) revert InvalidTimestampWindow();
        if (!openImmediately && opensAt <= block.timestamp) revert InvalidTimestampWindow();

        matchId = nextMatchId;
        nextMatchId += 1;

        MatchConfig storage matchConfig = _matches[matchId];
        matchConfig.id = matchId;
        matchConfig.entryPrice = entryPrice;
        matchConfig.rewardAmount = rewardAmount;
        matchConfig.opensAt = opensAt;
        matchConfig.closesAt = closesAt;
        matchConfig.totalMints = 0;
        matchConfig.winningMints = 0;
        matchConfig.winningOption = 0;
        matchConfig.state = openImmediately ? MatchState.Open : MatchState.Draft;
        matchConfig.exists = true;
        matchConfig.slug = slug;
        matchConfig.title = title;
        matchConfig.description = description;
        matchConfig.imageUri = imageUri;
        matchConfig.rewardAssetSymbol = rewardAssetSymbol;
        matchConfig.metadataUri = metadataUri;
        _slugToMatchId[slug] = matchId;

        uint256 optionsLength = options.length;
        for (uint256 index = 0; index < optionsLength; index += 1) {
            if (bytes(options[index]).length == 0) revert EmptyString();
            matchConfig.options.push(options[index]);
        }

        emit MatchCreated(matchId, slug, title, entryPrice, rewardAmount, opensAt, closesAt);

        if (openImmediately) {
            emit MatchOpened(matchId);
        }
    }

    function openMatch(uint256 matchId) external onlyOwner {
        MatchConfig storage matchConfig = _requireMatch(matchId);
        if (matchConfig.state != MatchState.Draft) revert MatchNotJoinable();
        matchConfig.state = MatchState.Open;
        emit MatchOpened(matchId);
    }

    function cancelMatch(uint256 matchId) external onlyOwner {
        MatchConfig storage matchConfig = _requireMatch(matchId);
        if (matchConfig.state == MatchState.Resolved || matchConfig.state == MatchState.Cancelled) revert MatchNotJoinable();
        matchConfig.state = MatchState.Cancelled;
        emit MatchCancelled(matchId);
    }

    function fundRewardPool(uint256 amount) external onlyOwner nonReentrant {
        if (amount == 0) revert InvalidOptions();
        quoteToken.safeTransferFrom(msg.sender, address(this), amount);
        emit RewardPoolFunded(amount);
    }

    function mintPrediction(uint256 matchId, uint8 selectedOption) external nonReentrant returns (uint256 tokenId) {
        MatchConfig storage matchConfig = _requireMatch(matchId);
        if (!_isMatchJoinable(matchConfig)) revert MatchNotJoinable();
        if (selectedOption >= matchConfig.options.length) revert InvalidOption();

        MintedPrediction storage prediction = _predictionsByMatchAndUser[matchId][msg.sender];
        if (prediction.exists) revert AlreadyMinted();

        tokenId = nextTokenId;
        nextTokenId += 1;

        prediction.tokenId = tokenId;
        prediction.selectedOption = selectedOption;
        prediction.claimed = false;
        prediction.exists = true;

        _predictionsByTokenId[tokenId] = prediction;
        _tokenToMatchId[tokenId] = matchId;

        matchConfig.totalMints += 1;
        _optionMintCounts[matchId][selectedOption] += 1;

        quoteToken.safeTransferFrom(msg.sender, address(this), matchConfig.entryPrice);
        _safeMint(msg.sender, tokenId);
        _setTokenURI(tokenId, matchConfig.metadataUri);

        emit MatchMinted(msg.sender, matchId, tokenId, selectedOption, matchConfig.entryPrice);
    }

    function resolveMatch(uint256 matchId, uint8 winningOption) external onlyOwner {
        MatchConfig storage matchConfig = _requireMatch(matchId);
        if (matchConfig.state != MatchState.Open) revert MatchNotResolvable();
        if (winningOption >= matchConfig.options.length) revert InvalidOption();

        matchConfig.state = MatchState.Resolved;
        matchConfig.winningOption = winningOption;
        matchConfig.winningMints = _optionMintCounts[matchId][winningOption];

        emit MatchResolved(matchId, winningOption, matchConfig.winningMints);
    }

    function claimReward(uint256 matchId) external nonReentrant {
        MatchConfig storage matchConfig = _requireMatch(matchId);
        if (matchConfig.state != MatchState.Resolved) revert MatchNotClaimable();

        MintedPrediction storage prediction = _predictionsByMatchAndUser[matchId][msg.sender];
        if (!prediction.exists) revert PredictionNotFound();
        if (prediction.claimed) revert PredictionAlreadyClaimed();
        if (prediction.selectedOption != matchConfig.winningOption) revert NotWinner();
        if (quoteToken.balanceOf(address(this)) < matchConfig.rewardAmount) revert InsufficientRewardLiquidity();

        prediction.claimed = true;
        _predictionsByTokenId[prediction.tokenId].claimed = true;

        quoteToken.safeTransfer(msg.sender, matchConfig.rewardAmount);

        emit RewardClaimed(msg.sender, matchId, prediction.tokenId, matchConfig.rewardAmount, true);
    }

    function withdrawRewardPool(address recipient, uint256 amount) external onlyOwner nonReentrant {
        if (recipient == address(0)) revert ZeroAddress();
        quoteToken.safeTransfer(recipient, amount);
        emit RewardPoolWithdrawn(recipient, amount);
    }

    function getMatch(uint256 matchId) external view returns (MatchSummary memory summary) {
        MatchConfig storage matchConfig = _requireMatch(matchId);
        summary = _toSummary(matchConfig);
    }

    function getPrediction(address participant, uint256 matchId) external view returns (MintedPrediction memory) {
        return _predictionsByMatchAndUser[matchId][participant];
    }

    function getPredictionByTokenId(uint256 tokenId) external view returns (MintedPrediction memory) {
        return _predictionsByTokenId[tokenId];
    }

    function getMatchIdForToken(uint256 tokenId) external view returns (uint256) {
        return _tokenToMatchId[tokenId];
    }

    function getOptionMintCount(uint256 matchId, uint8 optionId) external view returns (uint256) {
        return _optionMintCounts[matchId][optionId];
    }

    function getClaimableReward(address participant, uint256 matchId) external view returns (uint256) {
        MatchConfig storage matchConfig = _matches[matchId];
        if (!matchConfig.exists || matchConfig.state != MatchState.Resolved) {
            return 0;
        }

        MintedPrediction storage prediction = _predictionsByMatchAndUser[matchId][participant];
        if (!prediction.exists || prediction.claimed) {
            return 0;
        }

        return prediction.selectedOption == matchConfig.winningOption ? matchConfig.rewardAmount : 0;
    }

    function tokenURI(uint256 tokenId) public view override(ERC721URIStorage) returns (string memory) {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(bytes4 interfaceId) public view override(ERC721URIStorage) returns (bool) {
        return super.supportsInterface(interfaceId);
    }

    function _requireMatch(uint256 matchId) internal view returns (MatchConfig storage matchConfig) {
        matchConfig = _matches[matchId];
        if (!matchConfig.exists) revert MatchNotFound();
    }

    function _isMatchJoinable(MatchConfig storage matchConfig) internal view returns (bool) {
        return
            matchConfig.state == MatchState.Open && block.timestamp >= matchConfig.opensAt && block.timestamp < matchConfig.closesAt;
    }

    function _toSummary(MatchConfig storage matchConfig) internal view returns (MatchSummary memory summary) {
        string[] memory options = new string[](matchConfig.options.length);
        for (uint256 index = 0; index < matchConfig.options.length; index += 1) {
            options[index] = matchConfig.options[index];
        }

        summary = MatchSummary({
            id: matchConfig.id,
            entryPrice: matchConfig.entryPrice,
            rewardAmount: matchConfig.rewardAmount,
            opensAt: matchConfig.opensAt,
            closesAt: matchConfig.closesAt,
            totalMints: matchConfig.totalMints,
            winningMints: matchConfig.winningMints,
            winningOption: matchConfig.winningOption,
            state: matchConfig.state,
            exists: matchConfig.exists,
            slug: matchConfig.slug,
            title: matchConfig.title,
            description: matchConfig.description,
            imageUri: matchConfig.imageUri,
            rewardAssetSymbol: matchConfig.rewardAssetSymbol,
            metadataUri: matchConfig.metadataUri,
            options: options
        });
    }

    function _update(address to, uint256 tokenId, address auth) internal override returns (address) {
        address from = _ownerOf(tokenId);
        if (from != address(0) && to != address(0)) revert TransferDisabled();
        return super._update(to, tokenId, auth);
    }
}
