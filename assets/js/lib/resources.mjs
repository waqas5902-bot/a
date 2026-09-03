// Curated free resource library for students.

export const RESOURCE_CATEGORIES = [
  { id: 'courses', label: 'Courses' },
  { id: 'stem', label: 'STEM' },
  { id: 'coding', label: 'Coding' },
  { id: 'research', label: 'Writing & research' },
  { id: 'tools', label: 'Study tools' },
  { id: 'careers', label: 'Careers & money' }
];

export const RESOURCES = [
  { category: 'courses', title: 'Khan Academy', url: 'https://www.khanacademy.org/', blurb: 'Free video lessons and practice for school maths, science, economics and test prep.', tags: ['maths', 'science', 'exam prep'] },
  { category: 'courses', title: 'MIT OpenCourseWare', url: 'https://ocw.mit.edu/', blurb: 'Real MIT course materials — lecture notes, assignments and exams, no login needed.', tags: ['university', 'engineering'] },
  { category: 'courses', title: 'Coursera (audit free)', url: 'https://www.coursera.org/', blurb: 'University courses you can audit at no cost; pay only if you want the certificate.', tags: ['certificates', 'university'] },
  { category: 'courses', title: 'OpenStax', url: 'https://openstax.org/', blurb: 'Peer-reviewed, openly licensed textbooks for first-year university subjects.', tags: ['textbooks', 'free'] },
  { category: 'courses', title: 'CrashCourse', url: 'https://thecrashcourse.com/', blurb: 'Fast, well-produced revision videos across history, biology, psychology and more.', tags: ['video', 'revision'] },

  { category: 'stem', title: 'PhET Simulations', url: 'https://phet.colorado.edu/', blurb: 'Interactive physics, chemistry and maths simulations from the University of Colorado.', tags: ['physics', 'interactive'] },
  { category: 'stem', title: 'Desmos Graphing Calculator', url: 'https://www.desmos.com/calculator', blurb: 'Plot functions, build tables and explore transformations in the browser.', tags: ['maths', 'graphs'] },
  { category: 'stem', title: 'GeoGebra', url: 'https://www.geogebra.org/', blurb: 'Geometry, algebra and 3D graphing plus a huge library of shared classroom activities.', tags: ['geometry'] },
  { category: 'stem', title: 'Wolfram Alpha', url: 'https://www.wolframalpha.com/', blurb: 'Step-by-step solutions for algebra, calculus, statistics and unit conversions.', tags: ['calculator', 'steps'] },
  { category: 'stem', title: 'NASA STEM', url: 'https://www.nasa.gov/stem/', blurb: 'Real mission data, imagery and classroom activities straight from NASA.', tags: ['space', 'projects'] },

  { category: 'coding', title: 'freeCodeCamp', url: 'https://www.freecodecamp.org/', blurb: 'Structured, project-based curriculum from HTML to machine learning — completely free.', tags: ['projects', 'certificates'] },
  { category: 'coding', title: 'The Odin Project', url: 'https://www.theodinproject.com/', blurb: 'Full-stack web development path with a real portfolio by the end.', tags: ['web', 'portfolio'] },
  { category: 'coding', title: 'MDN Web Docs', url: 'https://developer.mozilla.org/', blurb: 'The reference for HTML, CSS and JavaScript — the place to check anything web.', tags: ['reference'] },
  { category: 'coding', title: 'CS50x (Harvard)', url: 'https://cs50.harvard.edu/x/', blurb: "Harvard's intro to computer science, free on edX with graded problem sets.", tags: ['computer science'] },
  { category: 'coding', title: 'GitHub Student Developer Pack', url: 'https://education.github.com/pack', blurb: 'Free pro tools, cloud credits and domains for verified students.', tags: ['discounts', 'tools'] },

  { category: 'research', title: 'Purdue OWL', url: 'https://owl.purdue.edu/', blurb: 'Citation formats, academic writing rules and sample papers (APA, MLA, Chicago).', tags: ['citation', 'writing'] },
  { category: 'research', title: 'Google Scholar', url: 'https://scholar.google.com/', blurb: 'Search academic papers and follow citations; many link to free PDFs.', tags: ['papers'] },
  { category: 'research', title: 'arXiv', url: 'https://arxiv.org/', blurb: 'Open preprint archive for physics, maths, computer science and economics.', tags: ['preprints', 'free'] },
  { category: 'research', title: 'PubMed', url: 'https://pubmed.ncbi.nlm.nih.gov/', blurb: 'Biomedical literature search with abstracts, useful for lab reports and essays.', tags: ['biology', 'medicine'] },
  { category: 'research', title: 'Zotero', url: 'https://www.zotero.org/', blurb: 'Free reference manager: save sources in one click and generate bibliographies.', tags: ['references'] },

  { category: 'tools', title: 'Anki', url: 'https://apps.ankiweb.net/', blurb: 'Spaced-repetition flashcards — the most efficient way to memorise for exams.', tags: ['flashcards', 'memory'] },
  { category: 'tools', title: 'Quizlet', url: 'https://quizlet.com/', blurb: 'Build or borrow study sets and drill them with games and mock tests.', tags: ['flashcards'] },
  { category: 'tools', title: 'Forest', url: 'https://www.forestapp.cc/', blurb: 'Phone-free focus timer that grows a virtual tree while you study.', tags: ['focus'] },
  { category: 'tools', title: 'Project Gutenberg', url: 'https://www.gutenberg.org/', blurb: 'Over 70,000 free public-domain books for literature essays and background reading.', tags: ['books', 'free'] },

  { category: 'careers', title: 'LinkedIn Learning (via library)', url: 'https://www.linkedin.com/learning/', blurb: 'Many university and public libraries give free access to the full catalogue.', tags: ['skills'] },
  { category: 'careers', title: 'Indeed Career Guide', url: 'https://www.indeed.com/career-advice', blurb: 'CV templates, interview question banks and salary data by role.', tags: ['cv', 'interviews'] },
  { category: 'careers', title: 'National Careers Service', url: 'https://nationalcareers.service.gov.uk/', blurb: 'Free careers advice, course finder and skills assessments (UK).', tags: ['advice'] },
  { category: 'careers', title: 'Scholarships.com', url: 'https://www.scholarships.com/', blurb: 'Searchable database of scholarships and grants for students.', tags: ['funding'] }
];

export function categoriesFor(resource) {
  return RESOURCE_CATEGORIES.filter((category) => category.id === resource.category);
}

export function filterResources({ category = 'all', query = '' } = {}) {
  const q = String(query || '').trim().toLowerCase();
  return RESOURCES.filter((resource) => {
    if (category !== 'all' && resource.category !== category) return false;
    if (!q) return true;
    const haystack = `${resource.title} ${resource.blurb} ${(resource.tags || []).join(' ')}`.toLowerCase();
    return haystack.includes(q);
  });
}
