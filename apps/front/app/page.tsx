import { AuthCta } from "@/components/layout/AuthCta";
import { HOME_AUTHENTICATED_CTA } from "@/components/layout/authLinks";
import { ActionLink } from "@/components/ui/ActionLink";
import { HomeWorld } from "@/app/HomeWorld";
import styles from "@/app/HomeWorld.module.css";

export default function Home() {
  return (
    <HomeWorld>
      <ActionLink href="/library" variant="primary" className={`sm:w-48 ${styles.primaryAction}`}>
        동화 체험하기
      </ActionLink>
      <AuthCta className="sm:w-48" authenticated={HOME_AUTHENTICATED_CTA} />
    </HomeWorld>
  );
}
