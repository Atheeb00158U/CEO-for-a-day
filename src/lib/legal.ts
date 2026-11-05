// The Grievance Officer the IT Rules 2021 ask us to name (Club rules, /terms, /privacy). The Club stays off for
// everyone but testers while any field below is "TODO" (clubOn in server/membership.ts).
export const GRIEVANCE = {
  name: "TODO", // Atheeb's full legal name
  email: "atheeb@gridd.ai",
  address: "TODO", // postal address
  /** CEO For A Day is a product of GRIDD AI (under AstrapiMoney); the registered company name goes here. */
  company: "TODO",
};

/** False while any grievance detail is still a placeholder. */
export const grievanceReady = () => !Object.values(GRIEVANCE).includes("TODO");
