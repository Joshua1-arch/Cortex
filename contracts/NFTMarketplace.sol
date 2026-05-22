// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";

contract NFTMarketplace is ReentrancyGuard, IERC721Receiver {
    using SafeERC20 for IERC20;

    struct Listing {
        address seller;
        uint256 price;
    }

    IERC20 public immutable quoteToken;

    mapping(address nftContract => mapping(uint256 tokenId => Listing)) public listings;

    event ItemListed(address indexed seller, address indexed nftContract, uint256 indexed tokenId, uint256 price);
    event ItemSold(
        address indexed buyer,
        address indexed seller,
        address indexed nftContract,
        uint256 tokenId,
        uint256 price
    );
    event ListingCanceled(address indexed seller, address indexed nftContract, uint256 indexed tokenId);

    error ZeroAddress();
    error InvalidPrice();
    error NotTokenOwner();
    error NotApprovedForMarketplace();
    error AlreadyListed();
    error NotListed();
    error SellerCannotBuyOwnItem();
    error NotListingSeller();

    constructor(address quoteToken_) {
        if (quoteToken_ == address(0)) revert ZeroAddress();
        quoteToken = IERC20(quoteToken_);
    }

    function listItem(address nftContract, uint256 tokenId, uint256 price) external nonReentrant {
        if (nftContract == address(0)) revert ZeroAddress();
        if (price == 0) revert InvalidPrice();

        IERC721 nft = IERC721(nftContract);
        if (nft.ownerOf(tokenId) != msg.sender) revert NotTokenOwner();
        if (listings[nftContract][tokenId].seller != address(0)) revert AlreadyListed();

        bool isApproved =
            nft.getApproved(tokenId) == address(this) || nft.isApprovedForAll(msg.sender, address(this));
        if (!isApproved) revert NotApprovedForMarketplace();

        listings[nftContract][tokenId] = Listing({seller: msg.sender, price: price});

        nft.safeTransferFrom(msg.sender, address(this), tokenId);

        emit ItemListed(msg.sender, nftContract, tokenId, price);
    }

    function buyItem(address nftContract, uint256 tokenId) external nonReentrant {
        Listing memory listing = listings[nftContract][tokenId];
        if (listing.seller == address(0)) revert NotListed();
        if (msg.sender == listing.seller) revert SellerCannotBuyOwnItem();

        delete listings[nftContract][tokenId];

        quoteToken.safeTransferFrom(msg.sender, listing.seller, listing.price);
        IERC721(nftContract).safeTransferFrom(address(this), msg.sender, tokenId);

        emit ItemSold(msg.sender, listing.seller, nftContract, tokenId, listing.price);
    }

    function cancelListing(address nftContract, uint256 tokenId) external nonReentrant {
        Listing memory listing = listings[nftContract][tokenId];
        if (listing.seller == address(0)) revert NotListed();
        if (listing.seller != msg.sender) revert NotListingSeller();

        delete listings[nftContract][tokenId];
        IERC721(nftContract).safeTransferFrom(address(this), msg.sender, tokenId);

        emit ListingCanceled(msg.sender, nftContract, tokenId);
    }

    function getListing(address nftContract, uint256 tokenId) external view returns (Listing memory) {
        return listings[nftContract][tokenId];
    }

    function onERC721Received(address, address, uint256, bytes calldata) external pure override returns (bytes4) {
        return IERC721Receiver.onERC721Received.selector;
    }
}
