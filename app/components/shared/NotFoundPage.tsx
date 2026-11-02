import { AppShell } from "./AppShell";
import { PageSection } from "./DefaultPage";
import { KernBody } from "./kern/KernBody";
import { KernHeading } from "./kern/KernHeading";
import { KernLabel } from "./kern/KernLabel";

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
          <div className="not-found__content">
            <KernLabel className="not-found__code">404</KernLabel>
            <KernHeading size="large" level={1}>
              Die Terminumfrage konnte nicht gefunden werden
            </KernHeading>
            <KernBody>
              Die von Ihnen gewünschte Terminumfrage ist leider nicht verfügbar. Möglicherweise
              wurde die Terminumfrage gelöscht. Wenn Sie die URL direkt eingegeben haben, überprüfen
              Sie die Schreibweise.
            </KernBody>
          </div>
        </PageSection>
      </div>
    </AppShell>
  );
}
