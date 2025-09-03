// Test UUID v4 format
const uuid = '550e8400-e29b-41d4-4a16-846655440000';
console.log('UUID:', uuid);

// UUID v4 format: 8-4-4-4-12 characters
// Version 4: 4th group starts with 4
// Variant: 5th group starts with 8, 9, a, or b
const parts = uuid.split('-');
console.log('Parts:', parts);
console.log('Lengths:', parts.map(p => p.length));

// Check if it's a valid UUID v4
const isValid = parts.length === 5 && 
                parts[0].length === 8 && 
                parts[1].length === 4 && 
                parts[2].length === 4 && 
                parts[3].length === 4 && 
                parts[4].length === 12 &&
                parts[3].startsWith('4') && 
                /^[89ab]/.test(parts[4]);

console.log('Is valid UUID v4:', isValid);

// The correct regex should be:
const correctRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{11}$/i;
console.log('Correct regex test:', correctRegex.test(uuid));

// Test with a known valid UUID v4
const validUUID = '550e8400-e29b-41d4-4a16-846655440000';
console.log('\nValid UUID:', validUUID);
console.log('Valid UUID test:', correctRegex.test(validUUID));

// Test with a truly valid UUID v4 from the internet
const internetUUID = '550e8400-e29b-41d4-a716-446655440000';
console.log('\nInternet UUID:', internetUUID);
console.log('Internet UUID test:', correctRegex.test(internetUUID));

// Check what the internet UUID parts are
const internetParts = internetUUID.split('-');
console.log('Internet parts:', internetParts);
console.log('Internet 4th part:', internetParts[3], 'starts with 4:', internetParts[3].startsWith('4'));
console.log('Internet 5th part:', internetParts[4], 'starts with 8,9,a,b:', /^[89ab]/.test(internetParts[4]));

// Create a truly valid UUID v4
const trueUUID = '550e8400-e29b-41d4-4a16-846655440000';
console.log('\nTrue UUID:', trueUUID);
console.log('True UUID test:', correctRegex.test(trueUUID));

// Check what the true UUID parts are
const trueParts = trueUUID.split('-');
console.log('True parts:', trueParts);
console.log('True 4th part:', trueParts[3], 'starts with 4:', trueParts[3].startsWith('4'));
console.log('True 5th part:', trueParts[4], 'starts with 8,9,a,b:', /^[89ab]/.test(trueParts[4]));

// Debug the regex step by step
console.log('\nDebugging regex:');
console.log('Part 1 (8 chars):', /^[0-9a-f]{8}$/i.test(parts[0]));
console.log('Part 2 (4 chars):', /^[0-9a-f]{4}$/i.test(parts[1]));
console.log('Part 3 (4 chars):', /^[0-9a-f]{4}$/i.test(parts[2]));
console.log('Part 4 (4 chars, starts with 4):', /^4[0-9a-f]{3}$/i.test(parts[3]));
console.log('Part 5 (12 chars, starts with 8,9,a,b):', /^[89ab][0-9a-f]{11}$/i.test(parts[4]));

// Test the full pattern step by step
const fullPattern = `^${parts[0]}-${parts[1]}-${parts[2]}-${parts[3]}-${parts[4]}$`;
console.log('\nFull pattern:', fullPattern);
console.log('Full pattern test:', new RegExp(fullPattern).test(uuid));

// Test the regex construction
console.log('\nRegex construction test:');
const testRegex = new RegExp('^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{11}$', 'i');
console.log('Test regex:', testRegex);
console.log('Test regex test:', testRegex.test(uuid));

// Test with a simpler regex first
const simpleRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
console.log('\nSimple regex test:', simpleRegex.test(uuid));

// Test the character class syntax
console.log('\nCharacter class test:');
const charClassRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{11}$/i;
console.log('Char class regex:', charClassRegex);
console.log('Char class test:', charClassRegex.test(uuid));

// Test with a different approach - check each part separately
console.log('\nPart-by-part test:');
const part1 = /^[0-9a-f]{8}$/i.test(parts[0]);
const part2 = /^[0-9a-f]{4}$/i.test(parts[1]);
const part3 = /^[0-9a-f]{4}$/i.test(parts[2]);
const part4 = /^4[0-9a-f]{3}$/i.test(parts[3]);
const part5 = /^[89ab][0-9a-f]{11}$/i.test(parts[4]);

console.log('All parts valid:', part1 && part2 && part3 && part4 && part5);

// Test the character class [89ab] specifically
console.log('\nCharacter class [89ab] test:');
console.log('5th part starts with 8:', /^8/.test(parts[4]));
console.log('5th part starts with 9:', /^9/.test(parts[4]));
console.log('5th part starts with a:', /^a/.test(parts[4]));
console.log('5th part starts with b:', /^b/.test(parts[4]));
console.log('5th part starts with [89ab]:', /^[89ab]/.test(parts[4]));

// Test a simpler version of the regex
const simpleV4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{11}$/i;
console.log('\nSimple V4 regex test:', simpleV4Regex.test(uuid));

// Test the exact regex from the test file
const testFileRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{11}$/i;
console.log('\nTest file regex test:', testFileRegex.test(uuid));

// Test with a different approach - build the regex step by step
console.log('\nBuilding regex step by step:');
const step1 = /^[0-9a-f]{8}$/i.test(parts[0]);
const step2 = /^[0-9a-f]{4}$/i.test(parts[1]);
const step3 = /^[0-9a-f]{4}$/i.test(parts[2]);
const step4 = /^4[0-9a-f]{3}$/i.test(parts[3]);
const step5 = /^[89ab][0-9a-f]{11}$/i.test(parts[4]);

console.log('Step 1 (8 chars):', step1);
console.log('Step 2 (4 chars):', step2);
console.log('Step 3 (4 chars):', step3);
console.log('Step 4 (4 chars, starts with 4):', step4);
console.log('Step 5 (12 chars, starts with 8,9,a,b):', step5);

// Test the full regex with each step
const fullRegex = new RegExp(`^${step1 ? parts[0] : '[0-9a-f]{8}'}-${step2 ? parts[1] : '[0-9a-f]{4}'}-${step3 ? parts[2] : '[0-9a-f]{4}'}-${step4 ? parts[3] : '4[0-9a-f]{3}'}-${step5 ? parts[4] : '[89ab][0-9a-f]{11}'}$`, 'i');
console.log('\nFull regex:', fullRegex);
console.log('Full regex test:', fullRegex.test(uuid));

// Try a different approach - use alternation instead of character class
console.log('\nTrying alternation approach:');
const altRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-(8|9|a|b)[0-9a-f]{11}$/i;
console.log('Alternation regex:', altRegex);
console.log('Alternation test:', altRegex.test(uuid));

// Try with explicit character matching
console.log('\nTrying explicit character matching:');
const explicitRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{11}$/i;
console.log('Explicit regex:', explicitRegex);
console.log('Explicit test:', explicitRegex.test(uuid));

// Test the 4th part more carefully
console.log('\nTesting 4th part carefully:');
const fourthPart = parts[3];
console.log('4th part:', fourthPart);
console.log('4th part length:', fourthPart.length);
console.log('4th part starts with 4:', fourthPart.startsWith('4'));
console.log('4th part after 4:', fourthPart.substring(1));
console.log('4th part after 4 length:', fourthPart.substring(1).length);
console.log('4th part regex test:', /^4[0-9a-f]{3}$/i.test(fourthPart));

// Test the 5th part more carefully
console.log('\nTesting 5th part carefully:');
const fifthPart = parts[4];
console.log('5th part:', fifthPart);
console.log('5th part length:', fifthPart.length);
console.log('5th part starts with 8:', fifthPart.startsWith('8'));
console.log('5th part after 8:', fifthPart.substring(1));
console.log('5th part after 8 length:', fifthPart.substring(1).length);
console.log('5th part regex test:', /^8[0-9a-f]{11}$/i.test(fifthPart));

// Test with a completely different UUID
console.log('\nTesting with a different UUID:');
const differentUUID = '12345678-1234-4123-8123-123456789abc';
console.log('Different UUID:', differentUUID);
console.log('Different UUID test:', correctRegex.test(differentUUID));

// Test with a known working UUID v4
console.log('\nTesting with a known working UUID v4:');
const workingUUID = '550e8400-e29b-41d4-4a16-846655440000';
console.log('Working UUID:', workingUUID);
console.log('Working UUID test:', correctRegex.test(workingUUID));

// Check if there are hidden characters by logging the raw bytes
console.log('\nChecking for hidden characters:');
console.log('UUID raw:', JSON.stringify(uuid));
console.log('UUID length:', uuid.length);
console.log('UUID char codes:', Array.from(uuid).map(c => c.charCodeAt(0)));
