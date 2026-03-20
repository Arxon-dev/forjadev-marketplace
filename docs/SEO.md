From this moment on, treat SEO as a permanent product requirement across the whole marketplace.

CONTEXT
We are building a premium marketplace web application inspired by platforms like Codefling, but with a more robust structure, cleaner UX, stronger internal architecture, and elite execution. SEO is not a late-stage add-on. It must be considered in every public-facing decision from now on.

CORE RULE
Do NOT build public pages, routes, listing systems, category systems, help content, seller pages, product pages, or discovery features without evaluating SEO implications first.

I want SEO-SAFE architecture by default, and SEO-STRONG implementation whenever the module is mature enough.

PRIMARY GOAL
Ensure that every indexable public page:
- has a clear search purpose
- targets a real user intent
- avoids duplication
- has clean and stable URLs
- is internally linked in a logical way
- is technically crawlable
- is structurally ready for metadata, schema, canonicals, and future optimization

SEO MINDSET
Do not think of SEO as “meta tags”.
Think of SEO in these layers:

1. INFORMATION ARCHITECTURE
- clean route hierarchy
- stable slugs
- logical content grouping
- strong internal linking
- indexable pages only when they add real value
- avoid orphan pages
- avoid unnecessary route proliferation

2. SEARCH INTENT
For each public page, determine:
- what user intent it serves
- whether it is transactional, informational, navigational, or trust/support-oriented
- whether it deserves indexation
- what makes it distinct from nearby pages

3. CONTENT QUALITY
Do not generate thin public pages.
A page should not exist just because the route can exist.
Every indexable page must have enough content and structure to deserve ranking.

4. TECHNICAL SEO
- metadata-ready architecture
- canonical-ready architecture
- schema-ready data modeling
- SSR or crawlable output where relevant
- pagination/faceting awareness
- prevention of duplicate indexable states
- performance awareness
- image optimization readiness
- breadcrumb readiness
- sitemap readiness

5. MARKETPLACE-SPECIFIC SEO
Pay special attention to:
- product pages
- category pages
- listing pages
- seller pages if public
- deal pages
- help center pages
- policy/trust pages
- bundles
- search/filter/facet pages
- pages that can accidentally create duplicate near-empty indexable content

PERMANENT DECISION RULE
Before implementing any public-facing module, always evaluate:

1. Should this page be indexable?
2. What exact search intent does it satisfy?
3. Is it unique enough to deserve ranking?
4. Could it create duplication with another page?
5. What should its canonical source be?
6. What metadata fields must exist in the model?
7. How should it be internally linked?
8. What content blocks are needed so it is not thin?
9. What should be crawlable in SSR output?
10. What SEO debt would this create if implemented carelessly?

MANDATORY FORMAT FOR ALL RELEVANT ITERATIONS
Whenever the task touches public-facing pages, discovery, categories, product pages, help content, policies, seller public profiles, or any other indexable surface, you must add these sections to your response:

1) SEO IMPACT
- What public surfaces are affected
- Whether they should be indexable
- What search intent each serves
- What SEO opportunity or risk exists

2) INDEXATION DECISION
For each relevant route or page type, explicitly state one of:
- indexable
- indexable later
- noindex
- blocked from indexation
- undecided pending maturity

Do not leave this ambiguous.

3) DUPLICATION RISK
State whether this feature could create:
- duplicate pages
- near-duplicate filtered pages
- duplicate metadata
- weak/thin pages
- content cannibalization

If yes, propose prevention.

4) REQUIRED SEO FIELDS
List the metadata or content structure the model should support, such as:
- title
- meta title
- meta description
- slug
- canonical source
- OG title
- OG description
- OG image
- intro/excerpt
- body content
- FAQ blocks
- breadcrumbs
- schema fields
- last reviewed / updated at
- indexation flags if needed

5) INTERNAL LINKING
Explain how the page should connect to:
- parent pages
- child pages
- sibling pages
- product pages
- categories
- help/policy pages
- seller pages
- related pages
- trust/support flows

6) SEO SAFETY CHECK
Before finalizing implementation, verify:
- no accidental duplicate indexable routes
- no thin public pages
- no unstable slugs
- no public pages without clear purpose
- no faceted/filter pages becoming indexable by mistake
- no metadata blind spots
- no orphan content

SEO RULES BY PAGE TYPE

A. PRODUCT PAGES
Each product page should eventually support:
- unique title strategy
- useful summary
- structured content blocks
- changelog/version context when relevant
- support/refund/update trust context
- related items
- seller trust signals
- FAQ or help context where useful
- schema readiness
Do not let product pages become thin or generic.

B. CATEGORY PAGES
Each category page should:
- have a clear purpose beyond listing cards
- support category intro content
- support unique metadata
- avoid becoming a near-duplicate of every other category
- be internally linked from navigation and relevant surfaces

C. LISTINGS / FILTERS / SEARCH
These are high-risk SEO areas.
Default rule:
- do not allow every filter combination to become indexable
- be deliberate about canonicalization
- avoid crawl waste
- distinguish between useful landing pages and disposable query states

D. HELP CENTER / POLICIES
These can be strong informational/trust SEO assets.
They should:
- serve real questions and buyer/seller concerns
- be structured for readability
- avoid overlap/cannibalization
- support article metadata
- support breadcrumbs and related links

E. SELLER PAGES
If seller pages are public, evaluate carefully:
- do they have enough value to rank?
- do they become thin if the seller has few products?
- what trust, identity, and product context do they contain?
Do not assume every public seller page deserves indexation.

F. DEALS / PROMOTIONS
These can create freshness and conversion opportunities, but can also generate duplicate/temporary clutter.
Be deliberate about:
- whether deals pages are indexable
- how expired promotions are handled
- whether promo pages are canonical to product pages or not

G. BUNDLES
Bundles should not become weak duplicates of their child products.
They need:
- distinct value proposition
- distinct copy
- distinct metadata
- clear relationship to included items

SEO IMPLEMENTATION RULES
When creating or modifying public-facing systems:
- prefer stable human-readable slugs
- avoid arbitrary ID-heavy URLs unless necessary
- model metadata fields early
- keep canonical strategy in mind even if not fully implemented yet
- structure content for headings and semantic hierarchy
- preserve SSR-friendly output where important
- avoid rendering core public meaning only after fragile client-side logic
- ensure empty states on public pages are handled safely and do not become thin indexed pages by accident

NOINDEX / CANONICAL AWARENESS
Default to caution for:
- internal search results
- arbitrary filter states
- incomplete public pages
- empty category/listing pages
- temporary promotional states
- low-value seller pages
- duplicate sorting/pagination states if not intentionally indexable

When relevant, explicitly recommend:
- canonical
- noindex
- redirect
- consolidation
- merge
- suppression from sitemap

SITEMAP / ROBOTS / DISCOVERY READINESS
Keep the project ready for:
- controlled sitemap generation
- selective inclusion of valuable public pages
- exclusion of junk pages
- robots-aware route planning
- future crawl budget protection

PERFORMANCE AS SEO
When designing public-facing experiences, also consider:
- server rendering where beneficial
- image weight
- loading patterns
- skeletons vs hidden content
- large client bundles
- unnecessary blocking scripts
- page structure that supports strong Core Web Vitals later

WHEN TO PUSH BACK
If a requested feature would create weak SEO structure, say so clearly.
Examples:
- too many thin pages
- duplicate category systems
- uncontrolled filter indexing
- public pages with almost no content
- overlapping informational pages
- unstable slug strategy
- conflicting route architecture

In such cases:
- explain the SEO risk
- propose a better structure
- implement the safer structure instead of blindly following the weaker idea

DEFINITION OF DONE FOR SEO-SAFE PUBLIC FEATURES
A public-facing feature should not be considered complete unless:
- its search purpose is defined
- indexation intent is decided
- URL strategy is clear
- metadata needs are known
- duplication risks are addressed
- internal linking is planned
- public content is not thin
- future canonical/schema/sitemap support is not blocked by the implementation

SPECIAL RULE FOR THIS PROJECT
We are aiming for a marketplace comparable to Codefling in functional depth, but more premium, more structured, and more robust. Therefore:
- SEO must support both transactional discovery and trust/informational layers
- product, category, help, policies, and seller trust surfaces must work together
- public architecture must be built for long-term organic growth, not just immediate functionality

FINAL WORKING RULE
Every time you touch a public page or route, ask:
“Does this improve organic discoverability safely, or does it create SEO debt?”
If it creates SEO debt, redesign it before moving forward.