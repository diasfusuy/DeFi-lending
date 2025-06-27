// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";

contract MockV3Aggregator is AggregatorV3Interface {
    uint8 public override decimals;
    int256 public latestAnswer;
    uint256 public latestTimestamp;
    uint256 public latestRound;
    uint80 public latestRoundId;

    mapping(uint80 => int256) public answers;
    mapping(uint80 => uint256) public timestamps;
    mapping(uint80 => uint256) public startedAt;

    constructor(uint8 _decimals, int256 _initialAnswer) {
        decimals = _decimals;
        updateAnswer(_initialAnswer);
    }

    function updateAnswer(int256 _answer) public {
        latestAnswer = _answer;
        latestTimestamp = block.timestamp;
        latestRound++;
        latestRoundId = uint80(latestRound);
        answers[latestRoundId] = _answer;
        timestamps[latestRoundId] = block.timestamp;
        startedAt[latestRoundId] = block.timestamp;
    }

    function getRoundData(uint80 _roundId) external view override returns (
        uint80 roundId, int256 answer, uint256 startedAt_, uint256 updatedAt, uint80 answeredInRound
    ) {
        require(answers[_roundId] > 0, "No data present");
        return (
            _roundId,
            answers[_roundId],
            startedAt[_roundId],
            timestamps[_roundId],
            _roundId
        );
    }

    function latestRoundData() external view override returns (
        uint80 roundId, int256 answer, uint256 startedAt_, uint256 updatedAt, uint80 answeredInRound
    ) {
        return (
            latestRoundId,
            latestAnswer,
            startedAt[latestRoundId],
            timestamps[latestRoundId],
            latestRoundId
        );
    }

    function description() external pure override returns (string memory) {
        return "MockV3Aggregator";
    }

    function version() external pure override returns (uint256) {
        return 0;
    }
}
