export const formatPence = (request: { readonly pence: number }): string => `£${(request.pence / 100).toFixed(2)}`;
