export declare function send(params: {
    to: string;
    subject: string;
    text: string;
}): Promise<{
    id: string;
    to: string;
    status: string;
    subject_len: number;
    body_len: number;
}>;
//# sourceMappingURL=gmail_send.mock.d.ts.map