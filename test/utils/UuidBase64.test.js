const { encode, decode } = require("../../src/utils/UuidBase64");

const { expect } = require('chai');

describe('@UuidBase64 Conversion tests', () => {
    it('should convert UUID to short string and back correctly', () => {
        // Given
        const originalUuid = 'f81d4fae-7dec-11d0-a765-00a0c91e6bf6';

        // When
        const shortString = encode(originalUuid);
        const restoredUuid = decode(shortString);

        // Then
        expect(restoredUuid).to.equal(originalUuid);
    });

    it('should convert specific UUID to expected short string', () => {
        // Given
        const uuid = '550e8400-e29b-41d4-a716-446655440000';
        const expectedShortString = 'VQ6EAOKbQdSnFkRmVUQAAA';  // Precomputed value

        // When
        const actualShortString = encode(uuid);

        // Then
        expect(actualShortString).to.equal(expectedShortString);
    });

    it('should handle different input formats (padding, whitespace)', () => {
        // Test padding handling
        const uuid1 = decode('VQ6EAC4pQdSnFkRmVVQAAA'); // without ==
        const uuid2 = decode('VQ6EAC4pQdSnFkRmVVQAAA=='); // with ==
        
        expect(uuid1).to.equal(uuid2, 'UUIDs should be equal regardless of padding');

        // Test trimming
        const uuid3 = decode('  VQ6EAC4pQdSnFkRmVVQAAA  ');
        expect(uuid1).to.equal(uuid3, 'Whitespace should be trimmed');
    });

    it('should handle edge cases (null UUID, max value UUID)', () => {
        // Test null UUID (all zeros)
        const nullUuid = '00000000-0000-0000-0000-000000000000';
        const nullShort = encode(nullUuid);
        expect(decode(nullShort)).to.equal(nullUuid);

        // Test max value UUID (not a real max, but close)
        const maxUuid = 'ffffffff-ffff-ffff-ffff-ffffffffffff';
        const maxShort = encode(maxUuid);
        expect(decode(maxShort)).to.equal(maxUuid);
    });
});