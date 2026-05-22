// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

contract SoulboundTrophy is ERC721, Ownable {
    using Strings for uint256;

    uint256 public constant MINT_PRICE = 0.001 ether;

    uint256 private _nextTokenId = 1;
    string private _baseTokenURI;
    mapping(uint256 tokenId => string uri) private _tokenURIs;

    error IncorrectMintPrice();
    error TokenIsSoulbound();
    error EtherTransferFailed();
    error URIQueryForNonexistentToken();

    constructor(string memory baseTokenURI_) ERC721("X Cup Soulbound Trophy", "XCUP-SBT") Ownable(msg.sender) {
        _baseTokenURI = baseTokenURI_;
    }

    function mint() external payable returns (uint256 tokenId) {
        if (msg.value != MINT_PRICE) revert IncorrectMintPrice();

        tokenId = _nextTokenId;
        _nextTokenId += 1;

        _safeMint(msg.sender, tokenId);
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
}
