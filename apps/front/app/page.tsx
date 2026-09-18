import { HOME_CREATE_CTA } from "@/components/layout/authLinks";
import { ActionLink } from "@/components/ui/ActionLink";
import { HomeWorld } from "@/app/HomeWorld";

export default function Home() {
  return (
    <HomeWorld>
      <ActionLink href="/library" prefetch variant="primary" className="sm:w-48">
        동화 둘러보기
      </ActionLink>
      <ActionLink href={HOME_CREATE_CTA.href} variant="secondary" className="sm:w-48" prefetch>
        {HOME_CREATE_CTA.cta}
      </ActionLink>
    </HomeWorld>
  );
}
