import { HOME_CREATE_CTA } from "@/components/layout/authLinks";
import { ActionLink } from "@/components/ui/ActionLink";
import { HomeWorld } from "@/app/HomeWorld";

export default function Home() {
  return (
    <HomeWorld>
      <ActionLink href="/stories/jack-and-beanstalk/capture?demo=true" prefetch variant="primary" className="sm:w-48">
        빠른 체험하기
      </ActionLink>
      <ActionLink href={HOME_CREATE_CTA.href} variant="secondary" className="sm:w-48" prefetch>
        {HOME_CREATE_CTA.cta}
      </ActionLink>
    </HomeWorld>
  );
}
