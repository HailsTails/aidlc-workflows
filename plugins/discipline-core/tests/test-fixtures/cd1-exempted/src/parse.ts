export const parsed = (request: { readonly text: string }) => JSON.parse(request.text) as any;
