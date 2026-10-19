export const fresh = (request: { readonly text: string }) => JSON.parse(request.text) as any;
