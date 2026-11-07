// Participation chooses who may decide; it never supplies evidence that a person
// replied. Summary, review, artifact and reserved-decision checks keep their owners.
export type StageApprovalMode = "human" | "autonomous";

export interface StageParticipationFacts {
  approvalMode?: StageApprovalMode;
  constructionGateAutonomous?: boolean;
  personDecision?: boolean;
  requireHuman?: boolean;
}

export function stageParticipationPolicy(facts: StageParticipationFacts = {}): {
  approvalMode: StageApprovalMode;
  routineQuestions: boolean;
  humanLearnings: boolean;
  autonomousApproval: boolean;
} {
  const autonomousStage = facts.approvalMode === "autonomous";
  return {
    approvalMode: autonomousStage ? "autonomous" : "human",
    routineQuestions: !autonomousStage,
    humanLearnings: !autonomousStage,
    // Construction keeps its existing grant. A stage's own grant never turns
    // an explicitly reported human decision into an assistant-authored one.
    autonomousApproval: !facts.requireHuman &&
      (facts.constructionGateAutonomous === true || (autonomousStage && !facts.personDecision)),
  };
}
