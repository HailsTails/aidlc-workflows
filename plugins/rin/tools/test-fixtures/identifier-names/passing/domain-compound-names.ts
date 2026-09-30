const parseResult = "ok" as const;
const userValue = 42;
const httpBody = { greeting: "hello" };
const retryOptions = { attempts: 3 };

const renderGreeting = (incomingRequest: { readonly userName: string }): string => {
  return `Hello, ${incomingRequest.userName}`;
};

export { httpBody, parseResult, renderGreeting, retryOptions, userValue };
