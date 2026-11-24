import { Form, useNavigation } from "react-router";

import { KernAlert } from "~/components/shared/kern/KernAlert";
import { KernBadge } from "~/components/shared/kern/KernBadge";
import { KernBody } from "~/components/shared/kern/KernBody";
import { KernButton } from "~/components/shared/kern/KernButton";
import { KernCluster } from "~/components/shared/kern/KernCluster";
import { KernHeading } from "~/components/shared/kern/KernHeading";
import { KernIcon, type KernIconName } from "~/components/shared/kern/KernIcon";
import { KernLabel } from "~/components/shared/kern/KernLabel";
import { KernLinkButton } from "~/components/shared/kern/KernLinkButton";
import { KernStack } from "~/components/shared/kern/KernStack";
import {
  KernCell,
  KernColumn,
  KernRow,
  KernRowHeader,
  KernTable,
  KernTableBody,
  KernTableHead,
} from "~/components/shared/kern/KernTable";
import type { InvitationChannel } from "~/database/types";

import { inviteIntent } from "./invitation";

import "./guests.css";

// A guest as the detail page shows them. The invitations, newest first, are already worded for
// display.
export type GuestRow = {
  id: string;
  email: string | null;
  safeId: string | null;
  name: string | null;
  // Where the guest's invitation is downloaded as a PDF for the ERV. Null without a SAFE-ID.
  ervPdf: string | null;
  invitations: Array<{ label: string; at: string }>;
};

function InviteButton({
  channel,
  guest,
  icon,
  label,
  disabled,
}: Readonly<{
  channel: InvitationChannel;
  guest: string;
  icon: KernIconName;
  label: string;
  disabled: boolean;
}>) {
  return (
    <KernButton
      type="submit"
      name="intent"
      value={inviteIntent(channel, guest)}
      style="secondary"
      className="kern-btn--small"
      disabled={disabled}
    >
      <KernIcon name={icon} />
      <KernLabel>{label}</KernLabel>
    </KernButton>
  );
}

// Every invitation with how and when it went out, newest first.
function InvitationStatus({ invitations }: Readonly<{ invitations: GuestRow["invitations"] }>) {
  if (invitations.length === 0) {
    return <KernBadge type="custom-grey">Nicht eingeladen</KernBadge>;
  }
  return (
    <KernStack as="ul" gap="sm" className="guests__invitations">
      {invitations.map(({ label, at }) => (
        <KernStack as="li" key={`${label} ${at}`} gap="xxs" align="start">
          <KernBadge type="success">{label}</KernBadge>
          <span className="guests__muted">am {at}</span>
        </KernStack>
      ))}
    </KernStack>
  );
}

// Where an invitation leads back to, so the judge sees the guest they just invited.
export const GUESTS_ANCHOR = "verfahrensbeteiligte";

// The people the judge listed, whether and how each was invited, and, while the survey is open,
// buttons to invite them. E-mail needs an address and the ERV a SAFE-ID, so a guest only gets the
// buttons that can reach them; marking an invitation sent outside the app is always possible.
// Inside a page section that has its own heading, the list goes without one.
export function Guests({
  guests,
  canInvite,
  heading = true,
  notSent,
}: Readonly<{
  guests: GuestRow[];
  canInvite: boolean;
  heading?: boolean;
  // The name of a guest whose e-mail could not be sent.
  notSent?: string;
}>) {
  const pending = useNavigation().state !== "idle";
  return (
    <KernStack
      as="section"
      gap="sm"
      id={GUESTS_ANCHOR}
      {...(heading
        ? { "aria-labelledby": "guests-heading" }
        : { "aria-label": "Verfahrensbeteiligte" })}
      className="kern-w-full"
    >
      {heading && (
        <KernHeading size="medium" level={2} id="guests-heading">
          Verfahrensbeteiligte
        </KernHeading>
      )}
      {notSent && (
        <KernAlert
          type="error"
          title={`Die Einladung an ${notSent} konnte nicht gesendet werden.`}
          message="Versuchen Sie es später erneut oder laden Sie die Person auf anderem Weg ein."
        />
      )}
      {guests.length === 0 ? (
        <KernBody>Sie haben keine Verfahrensbeteiligten angegeben.</KernBody>
      ) : (
        <Form method="post" className="guests__table-scroll">
          <KernTable
            caption="Verfahrensbeteiligte"
            hideCaption
            striped
            className="guests__table kern-w-full"
          >
            <KernTableHead>
              <KernRow>
                <KernColumn>Person</KernColumn>
                <KernColumn>Einladung</KernColumn>
                {canInvite && <KernColumn>Einladen</KernColumn>}
              </KernRow>
            </KernTableHead>
            <KernTableBody>
              {guests.map((guest) => {
                const who = guest.name ?? guest.email ?? guest.safeId ?? "";
                return (
                  <KernRow key={guest.id}>
                    <KernRowHeader>
                      <KernStack gap="xxs">
                        {guest.name && <span>{guest.name}</span>}
                        {guest.email && <span>{guest.email}</span>}
                        {guest.safeId && (
                          <span className="guests__safe-id">SAFE-ID: {guest.safeId}</span>
                        )}
                      </KernStack>
                    </KernRowHeader>
                    <KernCell>
                      <InvitationStatus invitations={guest.invitations} />
                    </KernCell>
                    {canInvite && (
                      <KernCell>
                        <KernCluster as="fieldset" gap="xs" className="guests__invite">
                          <legend className="kern-sr-only">{who} einladen</legend>
                          {guest.email && (
                            <InviteButton
                              channel="email"
                              guest={guest.id}
                              icon="mail"
                              label="Per E-Mail"
                              disabled={pending}
                            />
                          )}
                          {guest.safeId && (
                            <InviteButton
                              channel="erv"
                              guest={guest.id}
                              icon="arrow-forward"
                              label="Per ERV"
                              disabled={pending}
                            />
                          )}
                          {guest.ervPdf && (
                            // A download, not a page: the browser fetches it, not the router.
                            <KernLinkButton
                              to={guest.ervPdf}
                              reloadDocument
                              download
                              style="secondary"
                              className="kern-btn--small"
                            >
                              <KernIcon name="download" />
                              <KernLabel>PDF für ERV</KernLabel>
                            </KernLinkButton>
                          )}
                          <InviteButton
                            channel="manual"
                            guest={guest.id}
                            icon="check"
                            label="Als eingeladen markieren"
                            disabled={pending}
                          />
                        </KernCluster>
                      </KernCell>
                    )}
                  </KernRow>
                );
              })}
            </KernTableBody>
          </KernTable>
        </Form>
      )}
    </KernStack>
  );
}
