type GitHubRepo = {
  name: string;
  html_url: string;
  stargazers_count: number;
  fork: boolean;
  archived: boolean;
};

type GitHubPullRequest = {
  repository_url: string;
  updated_at: string;
};

type GitHubSearchResponse = {
  items?: GitHubPullRequest[];
};

type Contribution = {
  date: string;
  count: number;
  level: 0 | 1 | 2 | 3 | 4;
};

const USERNAME_PATTERN = /^[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?$/i;

function parseContributions(html: string): Contribution[] {
  const contributions: Contribution[] = [];
  const cells = html.matchAll(
    /<td\b([^>]*\bdata-date="[^"]+"[^>]*)><\/td>\s*<tool-tip\b[^>]*>(.*?)<\/tool-tip>/gs,
  );

  for (const [, attributes, tooltip] of cells) {
    const date = attributes.match(/\bdata-date="(\d{4}-\d{2}-\d{2})"/)?.[1];
    const level = Number(attributes.match(/\bdata-level="([0-4])"/)?.[1]);
    const countLabel = tooltip.match(/(No|[\d,]+) contributions?/i)?.[1];

    if (!date || !Number.isInteger(level) || !countLabel) continue;

    contributions.push({
      date,
      count: countLabel.toLowerCase() === "no" ? 0 : Number(countLabel.replaceAll(",", "")),
      level: level as Contribution["level"],
    });
  }

  return contributions.sort((a, b) => a.date.localeCompare(b.date));
}

export async function GET(request: Request) {
  const username = new URL(request.url).searchParams.get("username")?.trim();

  if (!username || !USERNAME_PATTERN.test(username)) {
    return Response.json({ error: "Invalid GitHub username" }, { status: 400 });
  }

  const headers: HeadersInit = {
    Accept: "application/vnd.github+json",
    "User-Agent": "vivek-portfolio",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  const token = process.env.GITHUB_TOKEN;
  if (token) headers.Authorization = `Bearer ${token}`;

  const [calendarResponse, reposResponse, pullRequestsResponse] = await Promise.all([
    fetch(`https://github.com/users/${encodeURIComponent(username)}/contributions`, {
      headers: { "User-Agent": "vivek-portfolio" },
    }),
    fetch(
      `https://api.github.com/users/${encodeURIComponent(username)}/repos?per_page=100&type=owner&sort=pushed`,
      { headers },
    ),
    fetch(
      `https://api.github.com/search/issues?q=${encodeURIComponent(`type:pr author:${username}`)}&per_page=100&sort=updated&order=desc`,
      { headers },
    ),
  ]);

  if (!calendarResponse.ok) {
    return Response.json({ error: "GitHub contribution calendar is unavailable" }, { status: 502 });
  }

  const contributions = parseContributions(await calendarResponse.text());
  if (!contributions.length) {
    return Response.json({ error: "GitHub returned an empty contribution calendar" }, { status: 502 });
  }

  const repositories: GitHubRepo[] = reposResponse.ok ? await reposResponse.json() : [];
  const publicRepos = repositories.filter((repo) => !repo.fork && !repo.archived);
  const stars = publicRepos.reduce((total, repo) => total + repo.stargazers_count, 0);
  const pullRequestSearch: GitHubSearchResponse = pullRequestsResponse.ok
    ? await pullRequestsResponse.json()
    : {};
  const contributionRepos = new Map<string, { count: number; updatedAt: string }>();

  for (const pullRequest of pullRequestSearch.items ?? []) {
    const fullName = pullRequest.repository_url.replace("https://api.github.com/repos/", "");
    const owner = fullName.split("/")[0];
    if (!owner || owner.toLowerCase() === username.toLowerCase()) continue;

    const current = contributionRepos.get(fullName);
    contributionRepos.set(fullName, {
      count: (current?.count ?? 0) + 1,
      updatedAt:
        !current || pullRequest.updated_at > current.updatedAt
          ? pullRequest.updated_at
          : current.updatedAt,
    });
  }

  const repos = [...contributionRepos.entries()]
    .sort(([, a], [, b]) => b.count - a.count || b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 8)
    .map(([fullName, contribution]) => {
      const owner = fullName.split("/")[0];
      return {
        name: fullName,
        count: contribution.count,
        unit: contribution.count === 1 ? "PR" : "PRs",
        logoUrl: `https://github.com/${owner}.png?size=64`,
      };
    });
  const pullRequests = [...contributionRepos.values()].reduce(
    (total, contribution) => total + contribution.count,
    0,
  );

  return Response.json(
    {
      contributions,
      repos,
      stars,
      pullRequests,
      contributedRepos: contributionRepos.size,
    },
    {
      headers: {
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
      },
    },
  );
}
