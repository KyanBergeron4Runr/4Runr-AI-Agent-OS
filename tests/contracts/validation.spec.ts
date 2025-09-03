import { describe, it, expect } from '@jest/globals';
import { validateRunCreate } from '../../packages/middleware/validation/schemas/RunCreate.schema';

describe('Validation Contracts', () => {
  describe('RunCreate Schema', () => {
    it('should reject empty name', () => {
      const result = validateRunCreate({ name: '' });
      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors?.length).toBeGreaterThan(0);

      const nameError = result.errors?.find(e => e.path === 'name');
      expect(nameError).toBeDefined();
      expect(nameError?.message).toContain('required');
    });

    it('should reject whitespace-only name', () => {
      const result = validateRunCreate({ name: '   ' });
      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors?.length).toBeGreaterThan(0);

      const nameError = result.errors?.find(e => e.path === 'name');
      expect(nameError).toBeDefined();
      expect(nameError?.message).toContain('empty or whitespace');
    });

    it('should reject over-long name', () => {
      const longName = 'a'.repeat(129);
      const result = validateRunCreate({ name: longName });
      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors?.length).toBeGreaterThan(0);

      const nameError = result.errors?.find(e => e.path === 'name');
      expect(nameError).toBeDefined();
      expect(nameError?.message).toContain('128 characters or less');
    });

    it('should reject wrong type for tags', () => {
      const result = validateRunCreate({ 
        name: 'test', 
        tags: 'not-an-array' as any 
      });
      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors?.length).toBeGreaterThan(0);

      const tagsError = result.errors?.find(e => e.path === 'tags');
      expect(tagsError).toBeDefined();
    });

    it('should reject oversized string input', () => {
      const largeInput = 'x'.repeat(65537); // 64KB + 1
      const result = validateRunCreate({ 
        name: 'test', 
        input: largeInput 
      });
      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors?.length).toBeGreaterThan(0);

      const inputError = result.errors?.find(e => e.path === 'input');
      expect(inputError).toBeDefined();
      expect(inputError?.message).toContain('64KB or less');
    });

    it('should reject oversized object input', () => {
      const largeObject = { data: 'x'.repeat(131073) }; // 128KB + 1 when serialized
      const result = validateRunCreate({ 
        name: 'test', 
        input: largeObject 
      });
      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors?.length).toBeGreaterThan(0);

      const inputError = result.errors?.find(e => e.path === 'input');
      expect(inputError).toBeDefined();
      expect(inputError?.message).toContain('128KB or less');
    });

    it('should accept valid input', () => {
      const validInput = {
        name: 'test-run',
        input: 'some input data',
        client_token: 'valid_token_123',
        tags: ['tag1', 'tag2']
      };
      
      const result = validateRunCreate(validInput);
      expect(result.success).toBe(true);
      expect(result.data).toEqual(validInput);
      expect(result.errors).toBeUndefined();
    });

    it('should accept minimal valid input', () => {
      const minimalInput = { name: 'test' };
      
      const result = validateRunCreate(minimalInput);
      expect(result.success).toBe(true);
      expect(result.data).toEqual(minimalInput);
      expect(result.errors).toBeUndefined();
    });
  });
});
