export const navigationLinks = [
  {
    href: "/library",
    label: "Library",
  },
  {
    href: "/scan/find",
    label: "Scan to Find",
  },
  {
    href: "/scan",
    label: "Scan to Borrow",
  },

  {
    img: "/icons/user.svg",
    selectedImg: "/icons/user-fill.svg",
    href: "/my-profile",
    label: "My Profile",
  },
];

export const adminSideBarLinks = [
  {
    img: "/icons/admin/home.svg",
    route: "/admin",
    text: "Home",
  },
  {
    img: "/icons/admin/users.svg",
    route: "/admin/users",
    text: "All Users",
  },
  {
    img: "/icons/admin/book.svg",
    route: "/admin/books",
    text: "All Books",
  },
  {
    img: "/icons/admin/bookmark.svg",
    route: "/admin/book-requests",
    text: "Borrow Requests",
  },
  {
    img: "/icons/admin/user.svg",
    route: "/admin/account-requests",
    text: "Account Requests",
  },
];

export const FIELD_NAMES = {
  fullName: "Full name",
  email: "Email",
  staffId: "SVYM Staff ID",
  password: "Password",
};

export const FIELD_TYPES = {
  fullName: "text",
  email: "email",
  staffId: "number",
  password: "password",
};

export const userRoles = [
  { value: "USER", label: "Member" },
  { value: "STAFF", label: "Staff" },
  { value: "ADMIN", label: "Admin" },
];

export const sampleBooks = [
  {
    id: 1,
    title: "Everybody Loves a Good Drought",
    author: "P. Sainath",
    genre: "Rural Development / Journalism",
    rating: 4.7,
    total_copies: 15,
    available_copies: 9,
    description:
      "A landmark account of poverty and rural life in India, documenting stories from the country's poorest districts.",
    color: "#5b3a29",
    cover: "https://m.media-amazon.com/images/I/71Q2Z4y1qBL.jpg",
    video: "/sample-video.mp4?updatedAt=1722593504152",
    summary:
      "P. Sainath spent years travelling India's poorest districts to document the human cost of underdevelopment, drought, and policy failure. The book remains a foundational text for anyone working in rural development and grassroots social work.",
  },
  {
    id: 2,
    title: "Development as Freedom",
    author: "Amartya Sen",
    genre: "Development Economics",
    rating: 4.6,
    total_copies: 12,
    available_copies: 6,
    description:
      "A foundational work arguing that development should be understood as the expansion of real freedoms people enjoy.",
    color: "#1c3d5a",
    cover: "https://m.media-amazon.com/images/I/71kBdC1pMdL.jpg",
    video: "/sample-video.mp4?updatedAt=1722593504152",
    summary:
      "Amartya Sen reframes economic development around the expansion of human capabilities and freedoms rather than GDP growth alone, a perspective central to community health and education work.",
  },
  {
    id: 3,
    title: "Health for All",
    author: "World Health Organization",
    genre: "Public Health / Rural Healthcare",
    rating: 4.3,
    total_copies: 20,
    available_copies: 14,
    description:
      "Guidelines and case studies on delivering primary healthcare in resource-limited and rural settings.",
    color: "#0d7a5f",
    cover: "https://m.media-amazon.com/images/I/61z2yzL0a3L.jpg",
    video: "/sample-video.mp4?updatedAt=1722593504152",
    summary:
      "A practical reference for community health workers and NGO staff delivering primary care in underserved rural areas, with case studies relevant to grassroots health programs.",
  },
  {
    id: 4,
    title: "Swami Vivekananda's Rousing Call to Hindu Nation",
    author: "Swami Vivekananda",
    genre: "Philosophy / Spiritual Leadership",
    rating: 4.8,
    total_copies: 25,
    available_copies: 18,
    description:
      "A collection of speeches and writings on service, self-reliance, and nation-building.",
    color: "#b5651d",
    cover: "https://m.media-amazon.com/images/I/71XU0Lj5JlL.jpg",
    video: "/sample-video.mp4?updatedAt=1722593504152",
    summary:
      "Swami Vivekananda's writings on service to humanity and self-reliance, foundational reading for organizations rooted in the spirit of grassroots social service.",
  },
  {
    id: 5,
    title: "Banker to the Poor",
    author: "Muhammad Yunus",
    genre: "Microfinance / Social Entrepreneurship",
    rating: 4.7,
    total_copies: 18,
    available_copies: 11,
    description:
      "The story of the Grameen Bank and the birth of microcredit as a tool against rural poverty.",
    color: "#2e7d32",
    cover: "https://m.media-amazon.com/images/I/81FpEz6+9CL.jpg",
    video: "/sample-video.mp4?updatedAt=1722593504152",
    summary:
      "Muhammad Yunus recounts how small, collateral-free loans to the rural poor sparked a global microfinance movement, a key reference for self-help-group and livelihoods programs.",
  },
  {
    id: 6,
    title: "Pedagogy of the Oppressed",
    author: "Paulo Freire",
    genre: "Education / Social Work",
    rating: 4.5,
    total_copies: 14,
    available_copies: 8,
    description:
      "A seminal text on education as a practice of freedom, widely used in community education and literacy programs.",
    color: "#7a1f3d",
    cover: "https://m.media-amazon.com/images/I/71D3z7nL1uL.jpg",
    video: "/sample-video.mp4?updatedAt=1722593504152",
    summary:
      "Paulo Freire's influential work on participatory, dialogue-based education remains essential reading for teachers and facilitators in rural and community education settings.",
  },
  {
    id: 7,
    title: "Kannada Folk Tales",
    author: "A.K. Ramanujan (ed.)",
    genre: "Regional Literature / Kannada",
    rating: 4.4,
    total_copies: 30,
    available_copies: 22,
    description:
      "A curated collection of folk tales from Karnataka, preserving regional oral storytelling traditions.",
    color: "#c97b2a",
    cover: "https://m.media-amazon.com/images/I/71Yz5n3JZGL.jpg",
    video: "/sample-video.mp4?updatedAt=1722593504152",
    summary:
      "A beloved collection of Karnataka folk tales, useful for children's reading programs and preserving regional storytelling traditions within the community.",
  },
  {
    id: 8,
    title: "The Idea of Justice",
    author: "Amartya Sen",
    genre: "Social Justice / Policy",
    rating: 4.4,
    total_copies: 10,
    available_copies: 7,
    description:
      "An examination of fairness, equity, and justice as applied to real-world social and economic conditions.",
    color: "#37474f",
    cover: "https://m.media-amazon.com/images/I/71m9rR1xV9L.jpg",
    video: "/sample-video.mp4?updatedAt=1722593504152",
    summary:
      "Amartya Sen explores practical approaches to justice and fairness, relevant to organizations engaged in policy advocacy and grassroots social reform.",
  },
];
