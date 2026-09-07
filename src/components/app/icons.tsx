import type { ReactNode, SVGProps } from "react";

export type IconProps = SVGProps<SVGSVGElement>;

function base(children: ReactNode, props: IconProps) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

export function IconUser(props: IconProps) {
  return base(
    <>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M4.5 20c1.6-3.6 4.6-5.5 7.5-5.5s5.9 1.9 7.5 5.5" />
    </>,
    props,
  );
}

export function IconGitBranch(props: IconProps) {
  return base(
    <>
      <circle cx="6" cy="6" r="2.2" />
      <circle cx="6" cy="18" r="2.2" />
      <circle cx="18" cy="8" r="2.2" />
      <path d="M6 8.2V15.8" />
      <path d="M18 10.2c0 4-4 5.8-8 5.8" />
    </>,
    props,
  );
}

export function IconShieldCheck(props: IconProps) {
  return base(
    <>
      <path d="M12 3.5 19 6.5v5c0 4.7-3 7.8-7 9-4-1.2-7-4.3-7-9v-5Z" />
      <path d="M9 12.2l2 2 4-4.2" />
    </>,
    props,
  );
}

export function IconSettings(props: IconProps) {
  return base(
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 13.5c.1-.5.1-1 0-1.5l1.8-1.4-1.6-2.8-2.1.7c-.4-.3-.9-.6-1.3-.8l-.3-2.2H9.9l-.3 2.2c-.5.2-.9.5-1.3.8l-2.1-.7-1.6 2.8L6.4 12c-.1.5-.1 1 0 1.5l-1.8 1.4 1.6 2.8 2.1-.7c.4.3.9.6 1.3.8l.3 2.2h3.6l.3-2.2c.5-.2.9-.5 1.3-.8l2.1.7 1.6-2.8-1.8-1.4Z" />
    </>,
    props,
  );
}

export function IconMenu(props: IconProps) {
  return base(
    <>
      <path d="M4 7h16" />
      <path d="M4 12h16" />
      <path d="M4 17h16" />
    </>,
    props,
  );
}

export function IconClose(props: IconProps) {
  return base(
    <>
      <path d="M6 6l12 12" />
      <path d="M18 6L6 18" />
    </>,
    props,
  );
}

export function IconChevronDown(props: IconProps) {
  return base(<path d="M6 9.5 12 15.5 18 9.5" />, props);
}

export function IconChevronRight(props: IconProps) {
  return base(<path d="M9 6 15 12 9 18" />, props);
}

export function IconExternalLink(props: IconProps) {
  return base(
    <>
      <path d="M10 6H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4" />
      <path d="M14 4h6v6" />
      <path d="M20 4 11 13" />
    </>,
    props,
  );
}

export function IconGithub(props: IconProps) {
  return base(
    <path d="M12 2.5c-5.3 0-9.5 4.2-9.5 9.5 0 4.3 2.7 7.9 6.6 9.2.5.1.6-.2.6-.5v-1.9c-2.7.6-3.3-1.2-3.3-1.2-.4-1.1-1-1.4-1-1.4-.9-.6.1-.6.1-.6 1 .1 1.5 1 1.5 1 .9 1.5 2.3 1.1 2.9.8.1-.7.4-1.1.6-1.4-2.2-.2-4.5-1.1-4.5-4.8 0-1.1.4-1.9 1-2.6-.1-.2-.4-1.2.1-2.6 0 0 .8-.3 2.7 1a9.4 9.4 0 0 1 5 0c1.9-1.3 2.7-1 2.7-1 .5 1.4.2 2.4.1 2.6.6.7 1 1.6 1 2.6 0 3.7-2.3 4.6-4.5 4.8.4.3.7.9.7 1.9v2.8c0 .3.2.6.6.5 3.9-1.3 6.6-4.9 6.6-9.2 0-5.3-4.2-9.5-9.5-9.5Z" />,
    { ...props, fill: "currentColor", stroke: "none" },
  );
}

export function IconWallet(props: IconProps) {
  return base(
    <>
      <path d="M4 7.5A2.5 2.5 0 0 1 6.5 5h11A2.5 2.5 0 0 1 20 7.5v9A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5v-9Z" />
      <path d="M15.5 12.2h2.3" />
      <path d="M4 9.5h16" />
    </>,
    props,
  );
}

export function IconRefresh(props: IconProps) {
  return base(
    <>
      <path d="M4 12a8 8 0 0 1 14-5.3L20 8" />
      <path d="M20 4v4h-4" />
      <path d="M20 12a8 8 0 0 1-14 5.3L4 16" />
      <path d="M4 20v-4h4" />
    </>,
    props,
  );
}

export function IconPullRequest(props: IconProps) {
  return base(
    <>
      <circle cx="7" cy="6" r="2" />
      <circle cx="7" cy="18" r="2" />
      <circle cx="17" cy="9" r="2" />
      <path d="M7 8v8" />
      <path d="M17 11v3.6a2.4 2.4 0 0 1-2.4 2.4H11" />
      <path d="M13.5 12.5 11 15l2.5 2.5" />
    </>,
    props,
  );
}

export function IconCommit(props: IconProps) {
  return base(
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M2.5 12h6.5" />
      <path d="M15 12h6.5" />
    </>,
    props,
  );
}

export function IconIssue(props: IconProps) {
  return base(
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 8.5v4.2" />
      <circle cx="12" cy="15.6" r="0.6" fill="currentColor" stroke="none" />
    </>,
    props,
  );
}

export function IconReview(props: IconProps) {
  return base(
    <>
      <path d="M2.5 12S5.8 5.5 12 5.5 21.5 12 21.5 12 18.2 18.5 12 18.5 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="2.6" />
    </>,
    props,
  );
}

export function IconCheckCircle(props: IconProps) {
  return base(
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M8.5 12.3 10.8 14.6 15.5 9.5" />
    </>,
    props,
  );
}

export function IconXCircle(props: IconProps) {
  return base(
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M9.5 9.5 14.5 14.5" />
      <path d="M14.5 9.5 9.5 14.5" />
    </>,
    props,
  );
}

export function IconCopyLink(props: IconProps) {
  return base(
    <>
      <path d="M9.5 14.5 14.5 9.5" />
      <path d="M10.8 6.6 12.4 5a3.4 3.4 0 0 1 4.8 4.8l-2 2" />
      <path d="M13.2 17.4 11.6 19a3.4 3.4 0 0 1-4.8-4.8l2-2" />
    </>,
    props,
  );
}

export function IconAlert(props: IconProps) {
  return base(
    <>
      <path d="M12 3.5 21 19.5H3L12 3.5Z" />
      <path d="M12 9.5v4.2" />
      <circle cx="12" cy="16.4" r="0.6" fill="currentColor" stroke="none" />
    </>,
    props,
  );
}
