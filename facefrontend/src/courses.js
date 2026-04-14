export const COLLEGE_NAME = "Guru Nanak Dev University College, Jalandhar";

export const DEPARTMENTS = [
  "Computer Science",
  "Commerce",
  "Management",
  "Journalism & Media",
  "Punjabi",
  "Information Technology",
  "Electronics & Communication",
  "Science",
  "Arts & Humanities",
  "Engineering",
];

export const CLASSES_BY_DEPARTMENT = {
  "Computer Science": [
    "BCA Sem 1","BCA Sem 2","BCA Sem 3","BCA Sem 4","BCA Sem 5","BCA Sem 6",
    "MCA Sem 1","MCA Sem 2","MCA Sem 3","MCA Sem 4",
  ],
  "Commerce": [
    "B.Com II Sec-A","B.Com II Sec-B","B.Com II Sec-C","B.Com II Sec-D",
    "B.Com IV Sec-A","B.Com IV Sec-B","B.Com IV Sec-C","B.Com IV Sec-D",
    "B.Com VI Sec-A","B.Com VI Sec-B","B.Com VI Sec-C","B.Com VI Sec-D",
    "B.Com (FS) II","B.Com (FS) IV","B.Com (FS) VI",
    "B.Voc II (E-Com & DM)","B.Voc IV (E-Com & DM)","B.Voc VI (E-Com & DM)",
    "M.Com II","M.Com IV",
  ],
  "Management": [
    "MBA (TYP) Sem II","MBA (TYP) Sem IV",
    "MBA (FYIP) Sem II","MBA (FYIP) Sem IV","MBA (FYIP) Sem VI",
    "MBA (FYIC) Sem VIII","MBA (FYIC) Sem X",
  ],
  "Journalism & Media": [
    "B.Voc II (J&M)","B.Voc IV (J&M)","B.Voc VI (J&M)",
  ],
  "Punjabi": [
    "M.A Punjabi Sem II","M.A Punjabi Sem IV",
  ],
  "Information Technology": [
    "BTech IT Sem 1","BTech IT Sem 2","BTech IT Sem 3","BTech IT Sem 4",
    "BTech IT Sem 5","BTech IT Sem 6","BTech IT Sem 7","BTech IT Sem 8",
  ],
  "Electronics & Communication": [
    "BTech ECE Sem 1","BTech ECE Sem 2","BTech ECE Sem 3","BTech ECE Sem 4",
    "BTech ECE Sem 5","BTech ECE Sem 6","BTech ECE Sem 7","BTech ECE Sem 8",
  ],
  "Science": [
    "BSc Physics Sem 1","BSc Physics Sem 2","BSc Chemistry Sem 1",
    "BSc Chemistry Sem 2","BSc Maths Sem 1","BSc Maths Sem 2",
    "BSc Biotechnology Sem 1","BSc Biotechnology Sem 2",
  ],
  "Arts & Humanities": [
    "BA English Sem 1","BA English Sem 2","BA History Sem 1",
    "BA History Sem 2","BA Political Science Sem 1","BA Political Science Sem 2",
    "BA Economics Sem 1","BA Economics Sem 2",
  ],
  "Engineering": [
    "BTech CSE Sem 1","BTech CSE Sem 2","BTech CSE Sem 3","BTech CSE Sem 4",
    "BTech CSE Sem 5","BTech CSE Sem 6","BTech CSE Sem 7","BTech CSE Sem 8",
  ],
};

export const ALL_CLASSES = Object.values(CLASSES_BY_DEPARTMENT).flat();

export const COURSES_BY_DEPARTMENT = {
  "Computer Science":            ["BCA","MCA"],
  "Commerce":                    ["B.Com","B.Com (FS)","B.Voc (E-Com & DM)","M.Com"],
  "Management":                  ["MBA (TYP)","MBA (FYIP)","MBA (FYIC)"],
  "Journalism & Media":          ["B.Voc (J&M)"],
  "Punjabi":                     ["M.A Punjabi"],
  "Information Technology":      ["BTech IT","MTech IT","Diploma IT"],
  "Electronics & Communication": ["BTech ECE","MTech ECE","BSc Electronics"],
  "Science":                     ["BSc Physics","BSc Chemistry","BSc Maths","BSc Biotechnology"],
  "Arts & Humanities":           ["BA English","BA History","BA Political Science","BA Economics"],
  "Engineering":                 ["BTech CSE","BTech Mechanical","BTech Civil","BTech EEE"],
};

export const ALL_COURSES = Object.values(COURSES_BY_DEPARTMENT).flat();

export const SEMESTERS_BY_COURSE = {
  "BCA":6,"MCA":4,"B.Com":6,"B.Com (FS)":6,"B.Voc (E-Com & DM)":6,
  "M.Com":4,"MBA (TYP)":4,"MBA (FYIP)":6,"MBA (FYIC)":10,
  "B.Voc (J&M)":6,"M.A Punjabi":4,
  "BTech IT":8,"MTech IT":4,"Diploma IT":6,
  "BTech ECE":8,"MTech ECE":4,"BSc Electronics":6,
  "BSc Physics":6,"BSc Chemistry":6,"BSc Maths":6,"BSc Biotechnology":6,
  "BA English":6,"BA History":6,"BA Political Science":6,"BA Economics":6,
  "BTech CSE":8,"BTech Mechanical":8,"BTech Civil":8,"BTech EEE":8,
};

export const getSemesters = (course) => {
  const count = SEMESTERS_BY_COURSE[course] || 8;
  return Array.from({ length: count }, (_, i) => i + 1);
};

// Default subjects per department — used by HOD timetable
export const DEFAULT_SUBJECTS_BY_DEPARTMENT = {
  "Computer Science": [
    "Mathematics & Statistics","Programming in C","Electronics Fundamentals",
    "Communication Skills","Database Management Systems (DBMS)",
    "C++ Programming","Computer Networks","Compiler Design",
    "Security in Computing","Computer Graphics","Operating Systems",
    "Distributed Systems","Deep Learning","Microprocessor",
    "Theory of Computation","Data Structures","Object Oriented Programming",
    "Software Engineering","Web Development","Artificial Intelligence",
    "Machine Learning","General Punjabi","General English",
    "Environmental Studies","DAB",
  ],
  "Commerce": [
    "Advanced Financial Accounting","Company Law","Business Economics",
    "E-Marketing and Consumer Behaviour","Advanced English Language",
    "Goods and Services Tax","Principles of Auditing","Cost Accounting",
    "Environmental Studies","Elements of Language Studies","DAB",
    "Business of Records","Quantitative Techniques","Marketing Management",
    "Internet Applications","DBMS","Web Design using XML and CSS",
    "Advanced Store Management","CMS Using OpenCart","Retail Management",
    "E-Commerce Website Development","Linux Server","Web Design Corel Draw",
    "Operations Research","Corporate Governance","Financial Services",
    "Research Methodology","E-Marketing","Project Management","General Punjabi",
  ],
  "Management": [
    "Business Research Methodology","Business Communication",
    "Financial Management","Human Resource Management",
    "Entrepreneurship Development","Strategic Management",
    "Financial Markets and Services","Strategic HRM","International FM",
    "Employee Involvement","Public Relations","Universal Human Values",
    "International HRM","Supply Chain Management","Marketing and Branding",
    "Corporate Accounting","Cyber Security","E-Commerce","General Punjabi",
  ],
  "Journalism & Media": [
    "News Reporting","Display and Publishing","Electronic News",
    "Media and Law","Public Relations","Marketing Management",
    "Community Studies","Television Journalism","Community Journalism",
    "Publication","FM Radio","General Knowledge & Current Affairs",
    "Communication Research","General Punjabi","DAB",
  ],
  "Punjabi": [
    "Punjabi Literature I","Punjabi Literature II","Punjabi Literature III",
    "Punjabi Grammar","Punjabi Language History","Punjabi Advanced Writing",
    "Sociology of Language","Modern Punjabi Literature","Punjabi Linguistics",
    "Punjabi Prose","Punjabi Poetry","Punjabi Drama","Punjabi Short Story",
  ],
  "Information Technology": [
    "Mathematics","Physics","Chemistry","English","Programming Fundamentals",
    "Data Structures","Object Oriented Programming","Database Systems",
    "Computer Networks","Operating Systems","Software Engineering",
    "Web Technologies","Microprocessors","Artificial Intelligence",
    "Machine Learning","Cloud Computing","Cyber Security","IoT","Project Work",
  ],
  "Electronics & Communication": [
    "Mathematics","Physics","Basic Electronics","Network Analysis",
    "Signals and Systems","Digital Electronics","Electronic Devices",
    "Electromagnetic Theory","Communication Systems","Microprocessors",
    "VLSI Design","DSP","Wireless Communication","Embedded Systems",
    "Control Systems","Antenna and Wave Propagation","Project Work",
  ],
  "Science": [
    "Mathematics","Physics I","Physics II","Chemistry I","Chemistry II",
    "Biology","Biotechnology","Environmental Science","Statistics",
    "Physical Chemistry","Organic Chemistry","Inorganic Chemistry",
    "Biochemistry","Genetics","Microbiology","Cell Biology","Project Work",
  ],
  "Arts & Humanities": [
    "English Literature I","English Literature II","English Language",
    "History of India I","History of India II","World History",
    "Political Theory","Indian Constitution","International Relations",
    "Macroeconomics","Microeconomics","Indian Economy",
    "Statistics for Economics","Sociology","Psychology","General Punjabi",
  ],
  "Engineering": [
    "Mathematics I","Mathematics II","Mathematics III","Physics","Chemistry",
    "English","Programming in C","Data Structures","OOP","DBMS",
    "Computer Networks","Operating Systems","Software Engineering",
    "Web Development","Compiler Design","Artificial Intelligence",
    "Machine Learning","Cloud Computing","Cyber Security","Project Work",
  ],
};

export const TIME_SLOTS = [
  { slot:1,label:"Period 1",start:"9:15", end:"10:15",startHour:9, startMinute:15,endHour:10,endMinute:15 },
  { slot:2,label:"Period 2",start:"10:15",end:"11:15",startHour:10,startMinute:15,endHour:11,endMinute:15 },
  { slot:3,label:"Period 3",start:"11:15",end:"12:15",startHour:11,startMinute:15,endHour:12,endMinute:15 },
  { slot:4,label:"Period 4",start:"12:15",end:"13:15",startHour:12,startMinute:15,endHour:13,endMinute:15 },
  { slot:5,label:"Period 5",start:"13:15",end:"14:15",startHour:13,startMinute:15,endHour:14,endMinute:15 },
  { slot:6,label:"Period 6",start:"14:15",end:"15:15",startHour:14,startMinute:15,endHour:15,endMinute:15 },
  { slot:7,label:"Period 7",start:"15:15",end:"16:15",startHour:15,startMinute:15,endHour:16,endMinute:15 },
];