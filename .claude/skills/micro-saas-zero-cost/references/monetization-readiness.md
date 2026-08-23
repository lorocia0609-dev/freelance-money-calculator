# Monetization readiness (without enabling it)

The goal is that turning ads on later is a configuration change, not a redesign.
Everything here is built up front and stays inert until monetization begins.

## Ad slots, reserved and disabled

Place `<AdSlot>` components where ads will eventually go and give each one a
**fixed reserved height** from the start. Until an ad network is configured they
render nothing visible — but they still occupy their space.

This matters more than it sounds. Injecting an ad into a layout that never
reserved room for it is the classic cause of a collapsed CLS score, and it lands
precisely when the site starts earning: rankings drop as revenue begins.
Reserving the space from day one also shows honestly, during design, how much of
the page ads will actually consume.

Sensible placements for a tool page: below the results block (highest value —
attention peaks there), between the explanation and the FAQ, and one in-content
unit further down. Do not place an ad above the tool. A visitor who has to scroll
past advertising to reach the thing they came for leaves, and both search
engines and ad networks penalize that layout.

Keep density low. Two to three units per page is plenty at this stage.

## Prerequisites for approval

Ad networks review the site before approving it. Have these in place first —
rejection triggers a waiting period, so it is cheaper to be ready than to retry:

- **Substantial original content.** A page that is only a form gets rejected as
  thin. This is the same requirement SEO imposes, so the work is shared.
- **Legal pages, in every locale**: privacy policy, cookie policy, terms of use.
- **An about page and a working contact method.** Reviewers check that a real
  person is behind the site.
- **Clear navigation** and no broken or placeholder pages.
- **A custom domain.** Subdomains you do not own — `*.pages.dev`,
  `*.github.io` — are generally not accepted, because you cannot prove ownership
  of the parent domain. This is the one unavoidable cost in the whole
  architecture (roughly $10–15/year). Tell the user the number plainly, and
  advise buying the domain *before* accumulating search authority: migrating
  domains later means a temporary ranking loss.
- **`ads.txt`** at the site root once an account exists, served from `public/`.

## Consent

Serving personalized ads to visitors in the EU/UK requires a certified consent
management platform and the ad network's consent signalling. Two rules that keep
this from becoming a problem:

1. **Do not ship a cookie banner before there are cookies.** Until analytics is
   cookieless and no ads are running, there is nothing to consent to, and an
   unnecessary banner costs engagement and adds layout shift.
2. **Design for it anyway.** The banner must be a fixed-height element that does
   not push content, and the site must remain fully usable if consent is denied.

Keep the privacy policy accurate as this changes: it should describe what
actually happens today, not what is planned.

## Analytics before monetization

Use a free, cookieless analytics option (Cloudflare Web Analytics is the default
here). Cookieless means no consent banner is required, and the data — which pages
attract traffic, which queries convert — is what tells you which tool to build
next.

## The switch

Gate ad rendering behind a single environment variable, e.g. `PUBLIC_ADS_ENABLED`.
When false, the slot renders its reserved space and nothing else. Enabling ads is
then one variable plus the network's script in the layout — with no layout
change, because the space was always there.
