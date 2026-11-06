import { AppShell } from "./AppShell";
import { PageSection } from "./DefaultPage";
import { KernBody } from "./kern/KernBody";
import { KernHeading } from "./kern/KernHeading";
import { KernLabel } from "./kern/KernLabel";
import { KernStack } from "./kern/KernStack";

import "./NotFoundPage.css";

// The title of the browser tab, set by the root layout while a 404 is shown.
export const NOT_FOUND_TITLE =
  "Terminumfrage nicht gefunden – Verhandlungstermin-Finder – Justiz-Services";

// Shown for every 404: a survey link that is invalid or was deleted, or any other unknown address.
export function NotFoundPage() {
  return (
    <AppShell showLanguageLinks>
      <div className="not-found">
        <PageSection width="content">
          <KernStack gap="md">
            <KernLabel className="not-found__code kern-m-none">404</KernLabel>
            <KernHeading className="kern-m-none" size="large" level={1}>
              Die Terminumfrage konnte nicht gefunden werden
            </KernHeading>
            <KernBody className="kern-m-none">
              Die von Ihnen gewünschte Terminumfrage ist leider nicht verfügbar. Möglicherweise
              wurde die Terminumfrage gelöscht. Wenn Sie die URL direkt eingegeben haben, überprüfen
              Sie die Schreibweise.
            </KernBody>
          </KernStack>
        </PageSection>
      </div>
    </AppShell>
  );
}
