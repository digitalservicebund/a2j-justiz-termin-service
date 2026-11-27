import { KernBody } from "~/components/shared/kern/KernBody";
import {
  KernDescriptionList,
  KernDescriptionListItem,
} from "~/components/shared/kern/KernDescriptionList";
import { ReviewPage } from "~/components/shared/ReviewPage";

import { formatMinutes, type CreateTerminValues } from "./schema";
import { groupSlotsByDay } from "./slot-days";

import "./draft.css";

type ReviewPerson = {
  id: string;
  email: string | null;
  safeId: string | null;
  name: string | null;
};

// "a@example.com", "Person A" or "a@example.com, SAFE-ID: DE.Example.1, Person A".
const describePerson = ({ email, safeId, name }: ReviewPerson) =>
  [email, safeId && `SAFE-ID: ${safeId}`, name].filter(Boolean).join(", ");

export function CreateTerminReview({
  values,
  court,
  participants,
}: Readonly<{
  values: CreateTerminValues;
  // The name of the court.
  court: string | null;
  participants: ReviewPerson[];
}>) {
  return (
    <ReviewPage
      sections={[
        {
          id: "verhandlungsdaten",
          title: "Verhandlungsdaten",
          children: (
            <KernDescriptionList>
              <KernDescriptionListItem label="Aktenzeichen">
                {values.aktenzeichen}
              </KernDescriptionListItem>
              {court && <KernDescriptionListItem label="Gericht">{court}</KernDescriptionListItem>}
              {values.minDurationMinutes !== null && (
                <KernDescriptionListItem label="Mindestdauer">
                  {formatMinutes(values.minDurationMinutes)}
                </KernDescriptionListItem>
              )}
            </KernDescriptionList>
          ),
        },
        {
          id: "verfahrensbeteiligte",
          title: "Verfahrensbeteiligte",
          children:
            participants.length === 0 ? (
              <KernBody>Sie haben keine Verfahrensbeteiligten angegeben.</KernBody>
            ) : (
              <ul className="review-page__list">
                {participants.map((person) => (
                  <li key={person.id}>{describePerson(person)}</li>
                ))}
              </ul>
            ),
        },
        {
          id: "zeitfenster",
          title: "Zeitfenster",
          children: (
            <KernDescriptionList>
              {groupSlotsByDay(values.slots).map(({ key, label, times }) => (
                <KernDescriptionListItem key={key} label={label}>
                  <ul className="review-page__list">
                    {times.map((time) => (
                      <li key={time}>{time}</li>
                    ))}
                  </ul>
                </KernDescriptionListItem>
              ))}
            </KernDescriptionList>
          ),
        },
      ]}
      submit={{ label: "Terminumfrage erstellen", intent: "create" }}
    />
  );
}
