import type { Site, Page, Links, Socials } from "@types"

// Global
export const SITE: Site = {
  TITLE: "Seungjun Heo",
  DESCRIPTION: "Personal blog of Seungjun Heo — notes on aerospace engineering, GNSS, and things I find interesting.",
  AUTHOR: "Seungjun Heo",
}

// Work Page
export const WORK: Page = {
  TITLE: "Work",
  DESCRIPTION: "Places I have worked.",
}

// Blog Page
export const BLOG: Page = {
  TITLE: "Blog",
  DESCRIPTION: "Writing on topics I am passionate about.",
}

// Projects Page
export const PROJECTS: Page = {
  TITLE: "Side Projects",
  DESCRIPTION: "Recent side projects I have worked on.",
}

// Search Page
export const SEARCH: Page = {
  TITLE: "Search",
  DESCRIPTION: "Search all posts and projects by keyword.",
}

// Links
export const LINKS: Links = [
  { 
    TEXT: "Home", 
    HREF: "/", 
  },
  { 
    TEXT: "Work", 
    HREF: "/work", 
  },
  { 
    TEXT: "Blog", 
    HREF: "/blog", 
  },
  {
    TEXT: "Side Projects",
    HREF: "/projects",
  },
]

// Socials
export const SOCIALS: Socials = [
  {
    NAME: "Email",
    ICON: "email",
    TEXT: "superjunn00@kaist.ac.kr",
    HREF: "mailto:superjunn00@kaist.ac.kr",
  },
  {
    NAME: "Github",
    ICON: "github",
    TEXT: "superjunn",
    HREF: "https://github.com/superjunn"
  },
]

