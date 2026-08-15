import { ButtonLink } from "@/components/ui/button";
import { SearchBox } from "@/components/search/search-box";
import { IconTile } from "@/components/ui/primitives";
import { getDictionary } from "@/lib/i18n";

export default async function NotFound() {
  const dict = await getDictionary();
  return (
    <div className="mx-auto max-w-xl px-4 py-24 text-center sm:px-6">
      <IconTile icon="compass" accent="indigo" size="lg" className="mx-auto" />
      <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-600">{dict.errors.notFoundEyebrow}</p>
      <h1 className="mt-1 text-2xl font-semibold tracking-[-0.02em] text-ink">{dict.errors.notFoundTitle}</h1>
      <p className="mx-auto mt-2 max-w-sm text-sm text-muted">{dict.errors.notFoundBody}</p>

      <div className="mt-6">
        <SearchBox size="md" />
      </div>

      <div className="mt-5 flex items-center justify-center gap-2">
        <ButtonLink href="/explore">{dict.nav.explore}</ButtonLink>
        <ButtonLink href="/" variant="outline">
          {dict.common.backHome}
        </ButtonLink>
      </div>
    </div>
  );
}
