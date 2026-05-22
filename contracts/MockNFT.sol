// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract MockNFT is ERC721, Ownable {
    uint256 private _nextTokenId = 1;

    constructor() ERC721("X Cup Collectible", "XCUP") Ownable(msg.sender) {}

    function mintTo(address to) external onlyOwner returns (uint256 tokenId) {
        tokenId = _nextTokenId;
        _nextTokenId += 1;
        _safeMint(to, tokenId);
    }

    function batchMintTo(address to, uint256 quantity) external onlyOwner returns (uint256[] memory tokenIds) {
        tokenIds = new uint256[](quantity);

        for (uint256 index = 0; index < quantity; index++) {
            uint256 tokenId = _nextTokenId;
            _nextTokenId += 1;
            _safeMint(to, tokenId);
            tokenIds[index] = tokenId;
        }
    }
}
