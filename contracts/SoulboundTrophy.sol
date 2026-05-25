// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

contract SoulboundTrophy is ERC721, Ownable {
    using Strings for uint256;

    uint256 public constant MINT_PRICE = 0.001 ether;
    uint256 public constant STARTER_REPUTATION = 100;
    uint256 public constant FAUCET_REWARD = 40;
    uint256 public constant SWAP_REWARD = 60;
    uint256 public constant PREDICTION_REWARD = 120;
    uint256 public constant WIN_REWARD = 180;

    enum CampaignOutcome {
        Pending,
        Home,
        Draw,
        Away,
        Cancelled
    }

    struct SupporterProfile {
        uint256 tokenId;
        uint256 reputation;
        uint256 level;
        uint256 predictionCount;
        uint256 correctPredictionCount;
        uint256 streak;
        uint256 longestStreak;
        uint256 claimCount;
        uint256 swapCount;
        uint256 lastUpdatedAt;
        bool founderMinted;
    }

    struct MatchCampaign {
        uint256 id;
        string slug;
        string homeTeam;
        string awayTeam;
        uint256 startsAt;
        uint256 closesAt;
        CampaignOutcome outcome;
        bool settled;
        bool exists;
    }

    struct PredictionReceipt {
        uint256 campaignId;
        uint8 pick;
        uint256 confidenceStake;
        bool settled;
        bool won;
        bool claimed;
        uint256 submittedAt;
    }

    uint256 private _nextTokenId = 1;
    uint256 private _nextCampaignId = 1;
    string private _baseTokenURI;
    mapping(uint256 tokenId => string uri) private _tokenURIs;
    mapping(address supporter => SupporterProfile profile) private _profiles;
    mapping(address supporter => bool) public hasFounderBadge;
    mapping(uint256 campaignId => MatchCampaign campaign) private _campaigns;
    mapping(address supporter => mapping(uint256 campaignId => PredictionReceipt receipt)) private _predictions;

    event FounderBadgeMinted(address indexed supporter, uint256 indexed tokenId, uint256 reputation, uint256 level);
    event ReputationActionRecorded(address indexed supporter, string indexed action, uint256 reward, uint256 reputation, uint256 level);
    event MatchCampaignCreated(
        uint256 indexed campaignId,
        string slug,
        string homeTeam,
        string awayTeam,
        uint256 startsAt,
        uint256 closesAt
    );
    event PredictionSubmitted(address indexed supporter, uint256 indexed campaignId, uint8 pick, uint256 confidenceStake);
    event MatchCampaignSettled(uint256 indexed campaignId, CampaignOutcome outcome);
    event PredictionClaimed(address indexed supporter, uint256 indexed campaignId, bool won, uint256 reputation, uint256 level);

    error IncorrectMintPrice();
    error TokenIsSoulbound();
    error EtherTransferFailed();
    error CampaignNotFound();
    error CampaignClosed();
    error PredictionAlreadySubmitted();
    error InvalidPredictionPick();
    error CampaignNotSettled();
    error PredictionNotFound();
    error PredictionAlreadyClaimed();
    error OutcomeNotPending();
    error InvalidCampaignWindow();
    error EmptyMetadata();

    constructor(string memory baseTokenURI_) ERC721("Cortex Supporter Passport", "COR-PASS") Ownable(msg.sender) {
        _baseTokenURI = baseTokenURI_;
    }

    function mint() external payable returns (uint256 tokenId) {
        if (msg.value != MINT_PRICE) revert IncorrectMintPrice();

        SupporterProfile storage profile = _profiles[msg.sender];
        if (profile.founderMinted) {
            return profile.tokenId;
        }

        tokenId = _nextTokenId;
        _nextTokenId += 1;

        _safeMint(msg.sender, tokenId);

        profile.tokenId = tokenId;
        profile.founderMinted = true;
        profile.reputation += STARTER_REPUTATION;
        profile.level = _deriveLevel(profile.reputation);
        profile.lastUpdatedAt = block.timestamp;
        hasFounderBadge[msg.sender] = true;

        emit FounderBadgeMinted(msg.sender, tokenId, profile.reputation, profile.level);
    }

    function recordFaucetClaim(address supporter) external onlyOwner {
        _recordActionReward(supporter, FAUCET_REWARD, "FAUCET");

        SupporterProfile storage profile = _profiles[supporter];
        profile.claimCount += 1;
    }

    function recordSwap(address supporter) external onlyOwner {
        _recordActionReward(supporter, SWAP_REWARD, "SWAP");

        SupporterProfile storage profile = _profiles[supporter];
        profile.swapCount += 1;
    }

    function createMatchCampaign(
        string calldata slug,
        string calldata homeTeam,
        string calldata awayTeam,
        uint256 startsAt,
        uint256 closesAt
    ) external onlyOwner returns (uint256 campaignId) {
        if (bytes(slug).length == 0 || bytes(homeTeam).length == 0 || bytes(awayTeam).length == 0) {
            revert EmptyMetadata();
        }

        if (closesAt <= startsAt || closesAt <= block.timestamp) {
            revert InvalidCampaignWindow();
        }

        campaignId = _nextCampaignId;
        _nextCampaignId += 1;

        _campaigns[campaignId] = MatchCampaign({
            id: campaignId,
            slug: slug,
            homeTeam: homeTeam,
            awayTeam: awayTeam,
            startsAt: startsAt,
            closesAt: closesAt,
            outcome: CampaignOutcome.Pending,
            settled: false,
            exists: true
        });

        emit MatchCampaignCreated(campaignId, slug, homeTeam, awayTeam, startsAt, closesAt);
    }

    function submitPrediction(uint256 campaignId, uint8 pick, uint256 confidenceStake) external {
        MatchCampaign storage campaign = _campaigns[campaignId];
        if (!campaign.exists) revert CampaignNotFound();
        if (campaign.settled || block.timestamp > campaign.closesAt) revert CampaignClosed();
        if (pick < 1 || pick > 3) revert InvalidPredictionPick();

        PredictionReceipt storage receipt = _predictions[msg.sender][campaignId];
        if (receipt.submittedAt != 0) revert PredictionAlreadySubmitted();

        receipt.campaignId = campaignId;
        receipt.pick = pick;
        receipt.confidenceStake = confidenceStake;
        receipt.submittedAt = block.timestamp;

        _recordActionReward(msg.sender, PREDICTION_REWARD, "PREDICTION");

        SupporterProfile storage profile = _profiles[msg.sender];
        profile.predictionCount += 1;

        emit PredictionSubmitted(msg.sender, campaignId, pick, confidenceStake);
    }

    function settleMatchCampaign(uint256 campaignId, CampaignOutcome outcome) external onlyOwner {
        MatchCampaign storage campaign = _campaigns[campaignId];
        if (!campaign.exists) revert CampaignNotFound();
        if (campaign.settled) revert OutcomeNotPending();
        if (outcome == CampaignOutcome.Pending) revert OutcomeNotPending();

        campaign.outcome = outcome;
        campaign.settled = true;

        emit MatchCampaignSettled(campaignId, outcome);
    }

    function claimPredictionResult(uint256 campaignId) external {
        MatchCampaign storage campaign = _campaigns[campaignId];
        if (!campaign.exists) revert CampaignNotFound();
        if (!campaign.settled) revert CampaignNotSettled();

        PredictionReceipt storage receipt = _predictions[msg.sender][campaignId];
        if (receipt.submittedAt == 0) revert PredictionNotFound();
        if (receipt.claimed) revert PredictionAlreadyClaimed();

        receipt.settled = true;
        receipt.claimed = true;

        bool won = uint8(campaign.outcome) == receipt.pick;
        receipt.won = won;

        SupporterProfile storage profile = _profiles[msg.sender];

        if (won) {
            profile.correctPredictionCount += 1;
            profile.streak += 1;
            if (profile.streak > profile.longestStreak) {
                profile.longestStreak = profile.streak;
            }

            _recordActionReward(msg.sender, WIN_REWARD, "PREDICTION_WIN");
        } else {
            profile.streak = 0;
            profile.lastUpdatedAt = block.timestamp;
        }

        emit PredictionClaimed(msg.sender, campaignId, won, profile.reputation, profile.level);
    }

    function getSupporterProfile(address supporter) external view returns (SupporterProfile memory) {
        return _profiles[supporter];
    }

    function getMatchCampaign(uint256 campaignId) external view returns (MatchCampaign memory) {
        MatchCampaign memory campaign = _campaigns[campaignId];
        if (!campaign.exists) revert CampaignNotFound();
        return campaign;
    }

    function getPrediction(address supporter, uint256 campaignId) external view returns (PredictionReceipt memory) {
        return _predictions[supporter][campaignId];
    }

    function withdraw() external onlyOwner {
        (bool success, ) = payable(owner()).call{value: address(this).balance}("");
        if (!success) revert EtherTransferFailed();
    }

    function setBaseURI(string calldata baseTokenURI_) external onlyOwner {
        _baseTokenURI = baseTokenURI_;
    }

    function setTokenURI(uint256 tokenId, string calldata tokenURI_) external onlyOwner {
        _requireOwned(tokenId);
        _tokenURIs[tokenId] = tokenURI_;
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);

        string memory customTokenURI = _tokenURIs[tokenId];
        if (bytes(customTokenURI).length > 0) {
            return customTokenURI;
        }

        string memory baseTokenURI = _baseURI();
        if (bytes(baseTokenURI).length == 0) {
            return "";
        }

        return string.concat(baseTokenURI, tokenId.toString());
    }

    function _baseURI() internal view override returns (string memory) {
        return _baseTokenURI;
    }

    function _update(address to, uint256 tokenId, address auth) internal override returns (address) {
        address from = _ownerOf(tokenId);

        if (from != address(0)) {
            revert TokenIsSoulbound();
        }

        return super._update(to, tokenId, auth);
    }

    function _recordActionReward(address supporter, uint256 reward, string memory actionLabel) internal {
        SupporterProfile storage profile = _profiles[supporter];
        profile.reputation += reward;
        profile.level = _deriveLevel(profile.reputation);
        profile.lastUpdatedAt = block.timestamp;

        emit ReputationActionRecorded(supporter, actionLabel, reward, profile.reputation, profile.level);
    }

    function _deriveLevel(uint256 reputation) internal pure returns (uint256) {
        if (reputation >= 800) return 5;
        if (reputation >= 500) return 4;
        if (reputation >= 300) return 3;
        if (reputation >= 150) return 2;
        if (reputation > 0) return 1;
        return 0;
    }
}
