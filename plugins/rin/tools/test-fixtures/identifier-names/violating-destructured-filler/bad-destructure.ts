const summariseIncident = (report: { readonly body: string }): string => {
  const { body } = report;
  return body;
};

export { summariseIncident };
