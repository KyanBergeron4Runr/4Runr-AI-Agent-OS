export interface EnvelopeResult {
    encryptedData: Buffer;
    encryptedKey: Buffer;
    iv: Buffer;
    tag: Buffer;
}
export interface EnvelopeDecryptResult {
    decryptedData: Buffer;
    dek: Buffer;
}
export declare function generateDEK(): Buffer;
export declare function wrapDEK(dek: Buffer, kek: Buffer): {
    wrappedKey: Buffer;
    iv: Buffer;
};
export declare function unwrapDEK(wrappedKey: Buffer, iv: Buffer, kek: Buffer): Buffer;
export declare function encryptWithEnvelope(data: Buffer, kek: Buffer): EnvelopeResult;
export declare function decryptWithEnvelope(envelope: EnvelopeResult, kek: Buffer): EnvelopeDecryptResult;
export declare function serializeEnvelope(envelope: EnvelopeResult): string;
export declare function deserializeEnvelope(serialized: string): EnvelopeResult;
export declare function encryptString(data: string, kek: Buffer): string;
export declare function decryptString(encryptedData: string, kek: Buffer): string;
export declare function encryptObject(obj: any, kek: Buffer): string;
export declare function decryptObject(encryptedData: string, kek: Buffer): any;
//# sourceMappingURL=envelope.d.ts.map