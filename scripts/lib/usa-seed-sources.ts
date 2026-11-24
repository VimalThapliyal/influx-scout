/** Shared USA ranking seed URLs (idea.txt + 2026 Feedspot/YTGrowth/Heepsy expansions). */

export type UsaSeedEntry = {
  niche: string;
  title: string;
  url: string;
};

/** Curated USA / US-audience roundups for seeds:sync + bank refill. */
export const USA_RANKING_SOURCES_EXPORT: UsaSeedEntry[] = [
  // —— HypeAuditor USA category leaderboards ——
  { niche: "finance", title: "HypeAuditor USA Finance", url: "https://hypeauditor.com/top-youtube-finance-and-economics-united-states/" },
  { niche: "education", title: "HypeAuditor USA Education", url: "https://hypeauditor.com/top-youtube-education-united-states/" },
  { niche: "tech", title: "HypeAuditor USA Science & Tech", url: "https://hypeauditor.com/top-youtube-science-and-technology-united-states/" },
  { niche: "fitness", title: "HypeAuditor USA Fitness", url: "https://hypeauditor.com/top-youtube-fitness-united-states/" },
  { niche: "beauty", title: "HypeAuditor USA Beauty", url: "https://hypeauditor.com/top-youtube-beauty-united-states/" },
  { niche: "gaming", title: "HypeAuditor USA Gaming", url: "https://hypeauditor.com/top-youtube-games-united-states/" },
  { niche: "travel", title: "HypeAuditor USA Travel", url: "https://hypeauditor.com/top-youtube-travel-united-states/" },
  { niche: "food", title: "HypeAuditor USA Food", url: "https://hypeauditor.com/top-youtube-food-and-drinks-united-states/" },
  { niche: "pets", title: "HypeAuditor USA Animals", url: "https://hypeauditor.com/top-youtube-animals-and-pets-united-states/" },
  { niche: "tech", title: "HypeAuditor USA Autos", url: "https://hypeauditor.com/top-youtube-autos-and-vehicles-united-states/" },
  { niche: "asmr", title: "HypeAuditor USA ASMR", url: "https://hypeauditor.com/top-youtube-asmr-united-states/" },
  { niche: "comedy", title: "HypeAuditor USA Comedy", url: "https://hypeauditor.com/top-youtube-comedy-united-states/" },
  { niche: "music", title: "HypeAuditor USA Music", url: "https://hypeauditor.com/top-youtube-music-united-states/" },
  { niche: "sports", title: "HypeAuditor USA Sports", url: "https://hypeauditor.com/top-youtube-sports-united-states/" },
  { niche: "howto", title: "HypeAuditor USA Howto & Style", url: "https://hypeauditor.com/top-youtube-howto-and-style-united-states/" },
  { niche: "all", title: "HypeAuditor Top YouTube USA", url: "https://hypeauditor.com/top-youtube-all-united-states/" },

  // —— Social Blade USA tops ——
  { niche: "all", title: "Social Blade Top 50 USA", url: "https://socialblade.com/youtube/lists/top/50/subscribers/all/US" },
  { niche: "gaming", title: "Social Blade Top Gaming USA", url: "https://socialblade.com/youtube/lists/top/50/subscribers/games/US" },
  { niche: "tech", title: "Social Blade Top Science USA", url: "https://socialblade.com/youtube/lists/top/50/subscribers/science/US" },
  { niche: "howto", title: "Social Blade Top Howto USA", url: "https://socialblade.com/youtube/lists/top/50/subscribers/howto/US" },
  { niche: "entertainment", title: "Social Blade Top Entertainment USA", url: "https://socialblade.com/youtube/lists/top/50/subscribers/entertainment/US" },
  { niche: "comedy", title: "Social Blade Top Comedy USA", url: "https://socialblade.com/youtube/lists/top/50/subscribers/comedy/US" },
  { niche: "music", title: "Social Blade Top Music USA", url: "https://socialblade.com/youtube/lists/top/50/subscribers/music/US" },
  { niche: "sports", title: "Social Blade Top Sports USA", url: "https://socialblade.com/youtube/lists/top/50/subscribers/sports/US" },
  { niche: "education", title: "Social Blade Top Education USA", url: "https://socialblade.com/youtube/lists/top/50/subscribers/education/US" },
  { niche: "people", title: "Social Blade Top People USA", url: "https://socialblade.com/youtube/lists/top/50/subscribers/people/US" },

  // —— Heepsy USA top pages ——
  { niche: "tech", title: "Heepsy Top Tech USA", url: "https://www.heepsy.com/top-youtube/tech/united-states" },
  { niche: "beauty", title: "Heepsy Top Beauty USA", url: "https://www.heepsy.com/top-youtube/beauty/united-states" },
  { niche: "fitness", title: "Heepsy Top Fitness USA", url: "https://www.heepsy.com/top-youtube/fitness/united-states" },
  { niche: "travel", title: "Heepsy Top Travel USA", url: "https://www.heepsy.com/top-youtube/travel/united-states" },
  { niche: "fashion", title: "Heepsy Top Fashion USA", url: "https://www.heepsy.com/top-youtube/fashion/united-states" },
  { niche: "food", title: "Heepsy Top Food USA", url: "https://www.heepsy.com/top-youtube/food/united-states" },
  { niche: "gaming", title: "Heepsy Top Gaming USA", url: "https://www.heepsy.com/top-youtube/gaming/united-states" },
  { niche: "lifestyle", title: "Heepsy Top Lifestyle USA", url: "https://www.heepsy.com/top-youtube/lifestyle/united-states" },
  { niche: "comedy", title: "Heepsy Top Comedy USA", url: "https://www.heepsy.com/top-youtube/comedy/united-states" },

  // —— Feedspot USA / American niche lists (strong channel-link density) ——
  { niche: "all", title: "Feedspot American YouTubers", url: "https://videos.feedspot.com/american_youtube_channels/" },
  { niche: "travel", title: "Feedspot USA Travel", url: "https://videos.feedspot.com/usa_travel_youtube_channels/" },
  { niche: "fashion", title: "Feedspot US Fashion", url: "https://videos.feedspot.com/us_fashion_youtube_channels/" },
  { niche: "beauty", title: "Feedspot American Makeup", url: "https://videos.feedspot.com/american_makeup_youtubers/" },
  { niche: "parenting", title: "Feedspot US Mom YouTubers", url: "https://videos.feedspot.com/us_mom_youtubers/" },
  { niche: "parenting", title: "Feedspot American Family", url: "https://videos.feedspot.com/american_family_youtube_channels/" },
  { niche: "comedy", title: "Feedspot American Comedy", url: "https://videos.feedspot.com/american_comedy_youtube_channels/" },
  { niche: "news", title: "Feedspot US News", url: "https://videos.feedspot.com/us_news_youtube_channels/" },
  { niche: "lifestyle", title: "Feedspot New York YouTubers", url: "https://videos.feedspot.com/new_york_youtube_channels/" },
  { niche: "lifestyle", title: "Feedspot California YouTubers", url: "https://videos.feedspot.com/california_youtube_channels/" },
  { niche: "lifestyle", title: "Feedspot Texas YouTubers", url: "https://videos.feedspot.com/texas_youtube_channels/" },
  { niche: "lifestyle", title: "Feedspot Florida YouTubers", url: "https://videos.feedspot.com/florida_youtube_channels/" },
  { niche: "lifestyle", title: "Feedspot Chicago YouTubers", url: "https://videos.feedspot.com/chicago_youtube_channels/" },
  { niche: "lifestyle", title: "Feedspot Los Angeles YouTubers", url: "https://videos.feedspot.com/los_angeles_youtube_channels/" },
  { niche: "fitness", title: "Feedspot Fitness YouTubers", url: "https://videos.feedspot.com/fitness_youtube_channels/" },
  { niche: "tech", title: "Feedspot Technology YouTubers", url: "https://videos.feedspot.com/technology_youtube_channels/" },
  { niche: "finance", title: "Feedspot Business YouTubers", url: "https://videos.feedspot.com/business_youtube_channels/" },
  { niche: "education", title: "Feedspot Educational YouTubers", url: "https://videos.feedspot.com/educational_youtube_channels/" },
  { niche: "career", title: "Feedspot Career YouTubers", url: "https://videos.feedspot.com/career_youtube_channels/" },
  { niche: "diy", title: "Feedspot DIY YouTubers", url: "https://videos.feedspot.com/diy_youtube_channels/" },
  { niche: "pets", title: "Feedspot Pet YouTubers", url: "https://videos.feedspot.com/pet_youtube_channels/" },
  { niche: "gaming", title: "Feedspot Gaming YouTubers", url: "https://videos.feedspot.com/gaming_youtube_channels/" },
  { niche: "beauty", title: "Feedspot Beauty YouTubers", url: "https://videos.feedspot.com/beauty_youtube_channels/" },
  { niche: "travel", title: "Feedspot Travel YouTubers", url: "https://videos.feedspot.com/travel_youtube_channels/" },
  { niche: "sports", title: "Feedspot Sports YouTubers", url: "https://videos.feedspot.com/sports_youtube_channels/" },
  { niche: "music", title: "Feedspot Music YouTubers", url: "https://videos.feedspot.com/music_youtube_channels/" },
  { niche: "asmr", title: "Feedspot ASMR YouTubers", url: "https://videos.feedspot.com/asmr_youtube_channels/" },

  // —— YTGrowth USA niche leaderboards ——
  { niche: "all", title: "YTGrowth Top USA", url: "https://ytgrowth.io/youtube-stats/country/united-states" },
  { niche: "beauty", title: "YTGrowth USA Beauty", url: "https://ytgrowth.io/youtube-stats/country/united-states/beauty" },
  { niche: "finance", title: "YTGrowth USA Finance", url: "https://ytgrowth.io/youtube-stats/country/united-states/finance" },
  { niche: "food", title: "YTGrowth USA Cooking", url: "https://ytgrowth.io/youtube-stats/country/united-states/cooking" },
  { niche: "fitness", title: "YTGrowth USA Fitness", url: "https://ytgrowth.io/youtube-stats/country/united-states/fitness" },
  { niche: "tech", title: "YTGrowth USA Tech", url: "https://ytgrowth.io/youtube-stats/country/united-states/tech" },
  { niche: "gaming", title: "YTGrowth USA Gaming", url: "https://ytgrowth.io/youtube-stats/country/united-states/gaming" },
  { niche: "travel", title: "YTGrowth USA Travel", url: "https://ytgrowth.io/youtube-stats/country/united-states/travel" },
  { niche: "education", title: "YTGrowth USA Education", url: "https://ytgrowth.io/youtube-stats/country/united-states/education" },
  { niche: "comedy", title: "YTGrowth USA Comedy", url: "https://ytgrowth.io/youtube-stats/country/united-states/comedy" },
  { niche: "sports", title: "YTGrowth USA Sports", url: "https://ytgrowth.io/youtube-stats/country/united-states/sports" },
  { niche: "music", title: "YTGrowth USA Music", url: "https://ytgrowth.io/youtube-stats/country/united-states/music" },
  { niche: "vlogs", title: "YTGrowth USA Vlogs", url: "https://ytgrowth.io/youtube-stats/country/united-states/vlogs" },

  // —— Editorial USA roundups ——
  { niche: "all", title: "TubeFilter Top 100 US Subs July 2025", url: "https://www.tubefilter.com/2025/08/05/top-100-most-subscribed-youtube-channels-july-2025/" },
  { niche: "all", title: "Viralyft Top YouTube Channels USA", url: "https://viralyft.com/blog/top-youtube-channels-in-usa" },
];
