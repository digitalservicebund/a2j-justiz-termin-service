import logoDark from "./bmjv-logo-dark.svg";
import logoLight from "./bmjv-logo-light.svg";

export function BmjvLogo() {
  return (
    <picture>
      <source srcSet={logoDark} media="(prefers-color-scheme: dark)" />
      <img
        src={logoLight}
        alt="Bundesministerium der Justiz und für Verbraucherschutz"
        width={181}
        height={99}
      />
    </picture>
  );
}
