// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title GradeEnum
/// @notice Shared uint8 grade encoding per DEC-grade-encoding-uint8.
/// @dev Mirror this mapping in agent (TS) and frontend (TS) constants files in Phase 2+.
library GradeEnum {
    uint8 internal constant AAA = 0;
    uint8 internal constant AA  = 1;
    uint8 internal constant A   = 2;
    uint8 internal constant BBB = 3;
    uint8 internal constant BB  = 4;
    uint8 internal constant B   = 5;
    uint8 internal constant CCC = 6;
    uint8 internal constant CC  = 7;
    uint8 internal constant C   = 8;
    uint8 internal constant D   = 9;

    /// @notice Maximum valid grade value (inclusive). Anything > MAX is invalid.
    uint8 internal constant MAX = 9;
}
