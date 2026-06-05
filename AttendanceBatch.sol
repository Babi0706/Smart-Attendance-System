// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract AttendanceBatch {
    struct Record {
        string uid;
        string method;
        string location; // New field for Gate/Classroom details
        uint256 timestamp;
    }

    Record[] public records;

    event AttendanceMarked(string uid, string method, string location, uint256 timestamp);
    event BatchAttendanceMarked(uint256 count, uint256 timestamp);

    // Mark a single student (for fallback/single scans)
    function markAttendance(string memory _uid, string memory _method, string memory _location) public {
        records.push(Record(_uid, _method, _location, block.timestamp));
        emit AttendanceMarked(_uid, _method, _location, block.timestamp);
    }

    // NEW: Mark multiple students in a SINGLE transaction
    function markAttendanceBatch(string[] memory _uids, string[] memory _methods, string memory _location) public {
        require(_uids.length == _methods.length, "Arrays must match in length");
        
        for (uint i = 0; i < _uids.length; i++) {
            records.push(Record(_uids[i], _methods[i], _location, block.timestamp));
            emit AttendanceMarked(_uids[i], _methods[i], _location, block.timestamp);
        }
        
        emit BatchAttendanceMarked(_uids.length, block.timestamp);
    }

    function getRecordsCount() public view returns (uint256) {
        return records.length;
    }
}
