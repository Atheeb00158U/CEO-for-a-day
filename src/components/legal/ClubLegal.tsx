// The Club's rules and the Grievance Officer, for /terms and /privacy (IT Rules 2021).
import { CLUB_COPY } from "@/lib/community";
import { GRIEVANCE } from "@/lib/legal";

export function ClubRules() {
  return (
    <>
      <h2>{CLUB_COPY.title}</h2>
      <p>{CLUB_COPY.legalIntro}</p>
      <ol>
        {CLUB_COPY.rules.map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ol>
      <p>{CLUB_COPY.rulesBreak}</p>
    </>
  );
}

export function Grievance() {
  return (
    <>
      <h2>{CLUB_COPY.grievanceTitle}</h2>
      <p>{CLUB_COPY.legalComplain}</p>
      <p>
        {GRIEVANCE.name}
        <br />
        <a className="underline" href={`mailto:${GRIEVANCE.email}`}>
          {GRIEVANCE.email}
        </a>
        <br />
        {GRIEVANCE.address}
      </p>
      <p>{CLUB_COPY.rulesReply}</p>
    </>
  );
}
