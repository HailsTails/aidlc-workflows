export const parsed = (request: { readonly text: string }): unknown => JSON.parse(request.text);
