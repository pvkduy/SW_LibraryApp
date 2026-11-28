#!/usr/bin/env node
/**
 * ShelfHelp — Deterministic Book & Copy Seed Generator (SCRUM-81, SRS §10.6)
 *
 * Generates 191 synthetic books (+ 9 existing fixture books = 200 total books)
 * and ~520 physical copies across all 6 Reader categories, 2 languages
 * (English & Vietnamese), standard/premium collections, active/draft statuses,
 * all 7 copy statuses, all 4 copy conditions, and ~14 out-of-stock active
 * titles for Reserve-Copy testing.
 *
 * Usage:
 *   node src/scripts/seed-books.mjs             # Generate & update src/supabase/seed.sql
 *   node src/scripts/seed-books.mjs --check     # Validate invariants without modifying files
 *   node src/scripts/seed-books.mjs --csv path  # Also export sample CSV (Admin ImportTab format)
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const REPO_ROOT = path.resolve(__dirname, '..', '..')
const SEED_SQL_PATH = path.join(REPO_ROOT, 'src', 'supabase', 'seed.sql')

const BEGIN_MARKER = '-- =============================================================================\n-- BEGIN GENERATED BOOK SEED (SCRUM-81) — DO NOT EDIT MANUALLY\n-- Regenerate with: node src/scripts/seed-books.mjs\n-- ============================================================================='
const END_MARKER = '-- =============================================================================\n-- END GENERATED BOOK SEED (SCRUM-81)\n-- ============================================================================='

const EXISTING_BOOK_COUNT = 9
const TARGET_TOTAL_BOOKS = 200
const GENERATED_BOOK_COUNT = TARGET_TOTAL_BOOKS - EXISTING_BOOK_COUNT // 191
const ADMIN_ACTOR_ID = '22222222-2222-2222-2222-222222222222'

const EXISTING_ISBN13 = new Set([
  '9780132350884',
  '9786040000001',
  '9786040000002',
  '9786040000003',
  '9780465050659',
  '9780735211292',
  '9780441172719',
  '9780553380163',
  '9780262046305',
])

const EXISTING_TITLES_LOWER = new Set([
  'clean code',
  'hóa học đại cương',
  'họa tiết dân tộc',
  'hoa văn việt nam',
  'the design of everyday things',
  'atomic habits',
  'dune',
  'a brief history of time',
  'introduction to algorithms',
])

// Deterministic PRNG (Mulberry32) so re-running produces byte-identical output.
function createRng(seed) {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function stripDiacritics(input) {
  return String(input || '')
    .normalize('NFC')
    .toLowerCase()
    .replace(/đ/g, 'd')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .normalize('NFC')
}

/** Compute valid EAN-13 ISBN with Mod-10 checksum (978 prefix). */
function buildIsbn13(prefix12) {
  if (!/^(978|979)\d{9}$/.test(prefix12)) {
    throw new Error(`Invalid ISBN-13 prefix: ${prefix12}`)
  }
  let sum = 0
  for (let i = 0; i < 12; i += 1) {
    const d = Number(prefix12[i])
    sum += i % 2 === 0 ? d : d * 3
  }
  const check = (10 - (sum % 10)) % 10
  return `${prefix12}${check}`
}

function validateIsbn13(isbn) {
  if (!/^(978|979)\d{10}$/.test(isbn)) return false
  let sum = 0
  for (let i = 0; i < 12; i += 1) {
    const d = Number(isbn[i])
    sum += i % 2 === 0 ? d : d * 3
  }
  return (10 - (sum % 10)) % 10 === Number(isbn[12])
}

/** Derive valid ISBN-10 from a 978-prefixed ISBN-13. */
function toIsbn10(isbn13) {
  if (!isbn13.startsWith('978')) return null
  const core9 = isbn13.slice(3, 12)
  let sum = 0
  for (let i = 0; i < 9; i += 1) {
    sum += Number(core9[i]) * (10 - i)
  }
  const rem = (11 - (sum % 11)) % 11
  return `${core9}${rem === 10 ? 'X' : String(rem)}`
}

// -----------------------------------------------------------------------------
// Curated Domain Catalog Pools (6 categories matching CataloguePage.jsx pills)
// NOTE: Strictly avoids 'hoa' (protecting TS-08), 'dune', 'brief history',
//       and titles ending with ' Book' (protecting rls_test.sql).
// -----------------------------------------------------------------------------
const EN_AUTHORS = [
  'Martin Kleppmann', 'Andrew Hunt', 'David Thomas', 'Eric Evans', 'Martin Fowler',
  'Kent Beck', 'Barbara Liskov', 'Donald Knuth', 'Brian Kernighan', 'Rob Pike',
  'Peter Norvig', 'Stuart Russell', 'Ian Goodfellow', 'Christopher Bishop', 'Judea Pearl',
  'Daniel Kahneman', 'Cal Newport', 'Yuval Harari', 'Malcolm Gladwell', 'Nassim Taleb',
  'Richard Feynman', 'Carl Sagan', 'Sean Carroll', 'Brian Greene', 'Carlo Rovelli',
  'Siddhartha Mukherjee', 'Ed Yong', 'Rachel Carson', 'Jane Goodall', 'Edward Wilson',
  'Ursula Le Guin', 'Isaac Asimov', 'Arthur Clarke', 'Ted Chiang', 'Kazuo Ishiguro',
  'Haruki Murakami', 'Margaret Atwood', 'Octavia Butler', 'Neal Stephenson', 'Andy Weir',
  'Dieter Rams', 'Josef Albers', 'Christopher Alexander', 'Ellen Lupton', 'Edward Tufte',
  'John Berger', 'Ernst Gombrich', 'Austin Kleon', 'Julie Zhuo', 'Marty Cagan',
  'Hannah Fry', 'Steven Strogatz', 'Jordan Ellenberg', 'Cathy ONeil', 'Tim Harford',
  'Daron Acemoglu', 'Esther Duflo', 'Amartya Sen', 'Raghuram Rajan', 'Mariana Mazzucato',
]

const VI_AUTHORS = [
  'Nguyễn Minh Tuấn', 'Trần Đức Hùng', 'Lê Phương Linh', 'Phạm Quốc Bảo', 'Đặng Thu Hà',
  'Vũ Nhật Minh', 'Bùi Thanh Tùng', 'Đỗ Lan Anh', 'Ngô Gia Huy', 'Dương Hải Yến',
  'Phan Trọng Nghĩa', 'Tạ Kim Ngân', 'Lý Quang Khải', 'Trịnh Ngọc Bích', 'Đinh Văn Sơn',
  'Mai Xuân Trường', 'Tô Khánh Vy', 'Châu Thành Đạt', 'Lương Thảo Nguyên', 'Kiều Hữu Phước',
  'Nguyễn Thị Hồng Nhung', 'Trần Văn Kiên', 'Lê Minh Triết', 'Phạm Anh Thư', 'Đặng Công Danh',
  'Vũ Bảo Ngọc', 'Bùi Đình Khôi', 'Đỗ Mỹ Duyên', 'Ngô Tấn Phát', 'Phan Nhật Ánh',
]

const EN_PUBLISHERS = {
  'Computer Science': ['OReilly Media', 'MIT Press', 'Addison-Wesley', 'Pragmatic Press', 'Manning Publications', 'No Starch Press'],
  'Science': ['Cambridge University Press', 'Oxford University Press', 'Princeton University Press', 'Penguin Science', 'Basic Press'],
  'Non-Fiction': ['Penguin Random House', 'HarperCollins', 'Simon & Schuster', 'Riverhead Press', 'Portfolio Press'],
  'Fiction': ['Tor Publishing', 'Orbit Press', 'Vintage Press', 'Faber & Faber', 'Gollancz'],
  'Natural Sciences': ['Academic Press', 'Springer Nature', 'Wiley Science', 'University of Chicago Press', 'Yale University Press'],
  'Arts': ['Phaidon Press', 'Thames & Hudson', 'Taschen', 'Princeton Architectural Press', 'Laurence King'],
}

const VI_PUBLISHERS = {
  'Computer Science': ['NXB Đại học Quốc gia TP.HCM', 'NXB Bách Khoa Hà Nội', 'NXB Thông tin và Truyền thông', 'NXB Trẻ'],
  'Science': ['NXB Giáo dục Việt Nam', 'NXB Đại học Quốc gia Hà Nội', 'NXB Tri thức', 'NXB Thế giới'],
  'Non-Fiction': ['NXB Trẻ', 'NXB Tổng hợp TP.HCM', 'NXB Tri thức', 'NXB Lao động'],
  'Fiction': ['NXB Văn học', 'NXB Hội Nhà văn', 'NXB Trẻ', 'NXB Kim Đồng'],
  'Natural Sciences': ['NXB Giáo dục Việt Nam', 'NXB Đại học Quốc gia TP.HCM', 'NXB Nông nghiệp', 'NXB Tài nguyên Môi trường'],
  'Arts': ['NXB Mỹ thuật', 'NXB Xây dựng', 'NXB Thế giới', 'NXB Văn nghệ'],
}

const CATEGORY_SPECS = [
  {
    category: 'Computer Science',
    targetCount: 36,
    shelfPrefix: 'Floor 2 • Shelf CS',
    wing: 'West Wing',
    priceRange: [145000, 420000],
    pageRange: [260, 860],
    fields: [
      'Software Engineering', 'Algorithms & Data Structures', 'Artificial Intelligence',
      'Distributed Systems', 'Databases', 'Cybersecurity', 'Computer Networks',
      'Operating Systems', 'Cloud Architecture',
    ],
    enTitles: [
      ['Designing Reliable Microservices', 'Distributed Systems', ['microservices', 'distributed', 'architecture', 'resilience']],
      ['Pragmatic Type Systems', 'Software Engineering', ['typescript', 'types', 'compilers', 'software']],
      ['Modern Relational Internals', 'Databases', ['postgres', 'sql', 'storage', 'indexing']],
      ['Practical Deep Learning Foundations', 'Artificial Intelligence', ['deep learning', 'neural networks', 'ai', 'tensors']],
      ['Zero-Trust Network Defense', 'Cybersecurity', ['security', 'cryptography', 'zero-trust', 'defense']],
      ['Concurrency in Systems Programming', 'Operating Systems', ['concurrency', 'threads', 'kernels', 'systems']],
      ['Graph Algorithms in Practice', 'Algorithms & Data Structures', ['graphs', 'algorithms', 'shortest path', 'optimization']],
      ['Event-Driven Platform Engineering', 'Cloud Architecture', ['events', 'streaming', 'kafka', 'cloud']],
      ['Compiler Construction Essentials', 'Software Engineering', ['compilers', 'ast', 'parsers', 'llvm']],
      ['Distributed Consensus Explained', 'Distributed Systems', ['raft', 'paxos', 'replication', 'fault tolerance']],
      ['Applied Natural Language Processing', 'Artificial Intelligence', ['nlp', 'transformers', 'embeddings', 'llm']],
      ['Web Performance Engineering', 'Software Engineering', ['web', 'rendering', 'caching', 'latency']],
      ['Linux Kernel Internals', 'Operating Systems', ['linux', 'kernel', 'memory', 'schedulers']],
      ['Query Optimization Patterns', 'Databases', ['databases', 'query planner', 'btree', 'transactions']],
      ['Protocol Design for Modern Networks', 'Computer Networks', ['tcp', 'http3', 'quic', 'networking']],
      ['Automated Testing at Scale', 'Software Engineering', ['testing', 'ci', 'playwright', 'quality']],
      ['Cryptography for Application Engineers', 'Cybersecurity', ['encryption', 'tls', 'hashing', 'authentication']],
      ['Reinforcement Learning Studio', 'Artificial Intelligence', ['rl', 'agents', 'policy gradient', 'ai']],
      ['Cloud-Native Observability', 'Cloud Architecture', ['metrics', 'tracing', 'logging', 'sre']],
      ['Functional Programming Patterns', 'Software Engineering', ['functional', 'immutability', 'monads', 'composition']],
      ['Data Structures for Competitive Coding', 'Algorithms & Data Structures', ['trees', 'heaps', 'dynamic programming', 'algorithms']],
      ['Container Runtime Internals', 'Cloud Architecture', ['docker', 'containers', 'cgroups', 'namespaces']],
    ],
    viTitles: [
      ['Cấu trúc dữ liệu và giải thuật ứng dụng', 'Algorithms & Data Structures', ['giải thuật', 'cấu trúc dữ liệu', 'lập trình', 'tối ưu']],
      ['Kiến trúc hệ thống phân tán hiện đại', 'Distributed Systems', ['hệ phân tán', 'kiến trúc', 'mở rộng', 'đồng bộ']],
      ['Nhập môn trí tuệ nhân tạo thực hành', 'Artificial Intelligence', ['trí tuệ nhân tạo', 'học máy', 'dữ liệu', 'mô hình']],
      ['Thiết kế cơ sở dữ liệu quan hệ', 'Databases', ['cơ sở dữ liệu', 'sql', 'ràng buộc', 'chỉ mục']],
      ['An toàn thông tin và mật mã ứng dụng', 'Cybersecurity', ['an toàn thông tin', 'mật mã', 'bảo mật', 'mạng']],
      ['Nguyên lý hệ điều hành và tiến trình', 'Operating Systems', ['hệ điều hành', 'tiến trình', 'bộ nhớ', 'lập lịch']],
      ['Mạng máy tính và giao thức truyền tin', 'Computer Networks', ['mạng máy tính', 'giao thức', 'định tuyến', 'internet']],
      ['Kỹ nghệ phần mềm hướng kiểm thử', 'Software Engineering', ['kiểm thử', 'phần mềm', 'quy trình', 'chất lượng']],
      ['Lập trình web toàn diện với JavaScript', 'Software Engineering', ['javascript', 'lập trình web', 'frontend', 'backend']],
      ['Điện toán đám mây cho kỹ sư trẻ', 'Cloud Architecture', ['đám mây', 'triển khai', 'hạ tầng', 'devops']],
      ['Học sâu và thị giác máy tính', 'Artificial Intelligence', ['học sâu', 'thị giác máy tính', 'mạng nơ-ron', 'ai']],
      ['Tối ưu truy vấn và hiệu năng SQL', 'Databases', ['sql', 'hiệu năng', 'truy vấn', 'giao dịch']],
      ['Phân tích thiết kế hướng đối tượng', 'Software Engineering', ['hướng đối tượng', 'uml', 'thiết kế', 'kiến trúc']],
      ['Xây dựng API bền vững và bảo mật', 'Software Engineering', ['api', 'rest', 'xác thực', 'bảo mật']],
    ],
  },
  {
    category: 'Science',
    targetCount: 34,
    shelfPrefix: 'Floor 2 • Shelf SC',
    wing: 'East Wing',
    priceRange: [120000, 360000],
    pageRange: [210, 680],
    fields: [
      'Physics', 'Mathematics', 'Data Science', 'Astronomy',
      'Neuroscience', 'Climate Science', 'Statistics', 'Quantum Mechanics',
    ],
    enTitles: [
      ['Quantum Fields Demystified', 'Quantum Mechanics', ['quantum', 'physics', 'fields', 'particles']],
      ['Linear Algebra for Data Scientists', 'Mathematics', ['linear algebra', 'matrices', 'eigenvalues', 'math']],
      ['Bayesian Thinking in Practice', 'Statistics', ['bayesian', 'probability', 'inference', 'statistics']],
      ['The Fabric of Cosmology', 'Astronomy', ['cosmology', 'galaxies', 'astrophysics', 'space']],
      ['Mapping the Human Connectome', 'Neuroscience', ['neuroscience', 'brain', 'synapses', 'cognition']],
      ['Statistical Learning and Prediction', 'Data Science', ['regression', 'classification', 'data science', 'modeling']],
      ['Thermodynamics and Entropy', 'Physics', ['thermodynamics', 'energy', 'entropy', 'mechanics']],
      ['Calculus of Variations', 'Mathematics', ['calculus', 'analysis', 'optimization', 'differential']],
      ['Planetary Climate Dynamics', 'Climate Science', ['climate', 'atmosphere', 'oceans', 'modeling']],
      ['Signals, Noise, and Information', 'Data Science', ['information theory', 'signals', 'entropy', 'analytics']],
      ['Relativity and Curved Spacetime', 'Physics', ['relativity', 'gravity', 'spacetime', 'einstein']],
      ['Number Theory and Prime Mysteries', 'Mathematics', ['primes', 'number theory', 'modular', 'proofs']],
      ['Exoplanets Beyond the Solar Rim', 'Astronomy', ['exoplanets', 'telescopes', 'astronomy', 'orbits']],
      ['Memory, Sleep, and Neural Plasticity', 'Neuroscience', ['memory', 'neurobiology', 'sleep', 'plasticity']],
      ['Causal Inference for Researchers', 'Statistics', ['causality', 'experiments', 'statistics', 'econometrics']],
      ['Optics and Photonics Fundamentals', 'Physics', ['optics', 'lasers', 'photonics', 'waves']],
      ['Stochastic Processes Made Clear', 'Mathematics', ['markov', 'stochastic', 'random', 'probability']],
      ['Computational Astrophysics', 'Astronomy', ['simulations', 'stars', 'astrophysics', 'numerical']],
      ['Experimental Design Essentials', 'Statistics', ['ab testing', 'experiments', 'sampling', 'hypothesis']],
      ['Electromagnetism in Modern Tech', 'Physics', ['electromagnetism', 'maxwell', 'circuits', 'waves']],
      ['Topology Through Visual Intuition', 'Mathematics', ['topology', 'geometry', 'manifolds', 'spaces']],
    ],
    viTitles: [
      ['Vật lý lượng tử cho người mới bắt đầu', 'Quantum Mechanics', ['lượng tử', 'vật lý', 'nguyên tử', 'năng lượng']],
      ['Đại số tuyến tính và ứng dụng kỹ thuật', 'Mathematics', ['đại số tuyến tính', 'ma trận', 'vectơ', 'toán học']],
      ['Xác suất thống kê trong phân tích dữ liệu', 'Statistics', ['xác suất', 'thống kê', 'dữ liệu', 'suy luận']],
      ['Thiên văn học và hành trình khám phá vũ trụ', 'Astronomy', ['thiên văn', 'vũ trụ', 'hành tinh', 'ngân hà']],
      ['Thần kinh học về trí nhớ và tập trung', 'Neuroscience', ['thần kinh', 'não bộ', 'trí nhớ', 'nhận thức']],
      ['Giải tích nhiều biến và phương trình vi phân', 'Mathematics', ['giải tích', 'vi phân', 'tích phân', 'toán cao cấp']],
      ['Biến đổi khí hậu và năng lượng tái tạo', 'Climate Science', ['khí hậu', 'năng lượng', 'môi trường', 'bền vững']],
      ['Cơ học cổ điển và dao động sóng', 'Physics', ['cơ học', 'dao động', 'sóng', 'vật lý']],
      ['Phân tích dữ liệu từ lý thuyết đến mô hình', 'Data Science', ['dữ liệu', 'mô hình', 'phân tích', 'dự báo']],
      ['Toán rời rạc và logic hình thức', 'Mathematics', ['toán rời rạc', 'logic', 'tổ hợp', 'đồ thị']],
      ['Quang học ứng dụng và công nghệ laser', 'Physics', ['quang học', 'ánh sáng', 'laser', 'vật lý']],
      ['Phân tích chuỗi thời gian hiện đại', 'Statistics', ['chuỗi thời gian', 'dự báo', 'thống kê', 'mô hình']],
      ['Địa vật lý và cấu trúc hành tinh', 'Astronomy', ['địa vật lý', 'trái đất', 'hành tinh', 'kiến tạo']],
    ],
  },
  {
    category: 'Non-Fiction',
    targetCount: 34,
    shelfPrefix: 'Floor 1 • Shelf NF',
    wing: 'North Wing',
    priceRange: [95000, 290000],
    pageRange: [180, 520],
    fields: [
      'Economics', 'Psychology', 'Productivity', 'History',
      'Philosophy', 'UX & Design', 'Management', 'Sociology',
    ],
    enTitles: [
      ['Deep Focus in a Noisy Era', 'Productivity', ['focus', 'deep work', 'attention', 'habits']],
      ['Behavioral Economics Explained', 'Economics', ['behavioral', 'decisions', 'markets', 'incentives']],
      ['Systems Thinking for Leaders', 'Management', ['systems', 'strategy', 'leadership', 'organizations']],
      ['The Silk Roads of Innovation', 'History', ['trade', 'history', 'civilizations', 'innovation']],
      ['Cognitive Biases and Clear Judgment', 'Psychology', ['psychology', 'bias', 'reasoning', 'mind']],
      ['Product Discovery Playbook', 'UX & Design', ['product', 'discovery', 'users', 'prototyping']],
      ['Ethics in the Age of Automation', 'Philosophy', ['ethics', 'philosophy', 'technology', 'society']],
      ['Macroeconomics and Global Trade', 'Economics', ['macroeconomics', 'inflation', 'trade', 'policy']],
      ['Urban Sociology and Public Space', 'Sociology', ['cities', 'communities', 'sociology', 'urban']],
      ['Negotiation Without Compromise', 'Management', ['negotiation', 'communication', 'strategy', 'leadership']],
      ['Research Methods in Human Factors', 'UX & Design', ['ux research', 'interviews', 'usability', 'design']],
      ['The Craft of Clear Technical Writing', 'Productivity', ['writing', 'clarity', 'documentation', 'communication']],
      ['Stoic Principles for Modern Work', 'Philosophy', ['stoicism', 'resilience', 'philosophy', 'mindset']],
      ['Financial Markets and Valuation', 'Economics', ['finance', 'markets', 'valuation', 'investing']],
      ['Maritime Empires of Southeast Asia', 'History', ['southeast asia', 'maritime', 'history', 'trade']],
      ['Team Topologies and Collaboration', 'Management', ['teams', 'organization', 'collaboration', 'agile']],
      ['The Psychology of Motivation', 'Psychology', ['motivation', 'flow', 'intrinsic', 'learning']],
      ['Critical Thinking Toolkit', 'Philosophy', ['logic', 'arguments', 'critical thinking', 'evidence']],
      ['Digital Economy and Platform Strategy', 'Economics', ['platforms', 'network effects', 'economics', 'digital']],
      ['Social Networks and Collective Behavior', 'Sociology', ['networks', 'influence', 'society', 'behavior']],
      ['Accessible Digital Interfaces', 'UX & Design', ['accessibility', 'wcag', 'inclusive design', 'ui']],
    ],
    viTitles: [
      ['Kinh tế học vi mô và quyết định thị trường', 'Economics', ['kinh tế vi mô', 'thị trường', 'cung cầu', 'chiến lược']],
      ['Tâm lý học hành vi trong đời sống hiện đại', 'Psychology', ['tâm lý học', 'hành vi', 'quyết định', 'nhận thức']],
      ['Phương pháp quản lý thời gian cho sinh viên', 'Productivity', ['quản lý thời gian', 'hiệu suất', 'tập trung', 'kỹ năng']],
      ['Lịch sử thương mại Đông Nam Á cổ trung đại', 'History', ['lịch sử', 'đông nam á', 'thương mại', 'biển đảo']],
      ['Tư duy phản biện và lập luận sắc bén', 'Philosophy', ['tư duy phản biện', 'lập luận', 'triết học', 'logic']],
      ['Thiết kế trải nghiệm người dùng thực chiến', 'UX & Design', ['trải nghiệm người dùng', 'ux', 'giao diện', 'nghiên cứu']],
      ['Quản trị dự án tinh gọn trong doanh nghiệp', 'Management', ['quản trị dự án', 'agile', 'lãnh đạo', 'nhóm']],
      ['Xã hội học đô thị và không gian cộng đồng', 'Sociology', ['xã hội học', 'đô thị', 'cộng đồng', 'phát triển']],
      ['Tài chính cá nhân và đầu tư bền vững', 'Economics', ['tài chính', 'đầu tư', 'tiết kiệm', 'quản lý']],
      ['Nghệ thuật thuyết trình và giao tiếp thuyết phục', 'Productivity', ['giao tiếp', 'thuyết trình', 'kỹ năng mềm', 'tự tin']],
      ['Lịch sử giáo dục đại học thế giới', 'History', ['lịch sử', 'giáo dục', 'đại học', 'tri thức']],
      ['Đạo đức công nghệ trong kỷ nguyên số', 'Philosophy', ['đạo đức', 'công nghệ', 'triết học', 'xã hội']],
      ['Khởi nghiệp tinh gọn và kiểm chứng thị trường', 'Management', ['khởi nghiệp', 'sản phẩm', 'thị trường', 'đổi mới']],
    ],
  },
  {
    category: 'Fiction',
    targetCount: 33,
    shelfPrefix: 'Floor 3 • Shelf FI',
    wing: 'South Wing',
    priceRange: [75000, 235000],
    pageRange: [176, 592],
    fields: [
      'Sci-Fi', 'Literary Fiction', 'Mystery & Thriller',
      'Historical Fiction', 'Fantasy', 'Short Stories',
    ],
    enTitles: [
      ['The Glass Observatory', 'Sci-Fi', ['sci-fi', 'space', 'observatory', 'novel']],
      ['Letters from the Harbor', 'Literary Fiction', ['literary', 'letters', 'coastal', 'drama']],
      ['Midnight on the Eastern Express', 'Mystery & Thriller', ['mystery', 'detective', 'suspense', 'train']],
      ['The Cartographer of Amber Coast', 'Historical Fiction', ['historical', 'maps', 'voyage', 'adventure']],
      ['Chronicles of the Silver Spire', 'Fantasy', ['fantasy', 'magic', 'kingdom', 'epic']],
      ['Orbits of Quiet Stars', 'Short Stories', ['anthology', 'short stories', 'sci-fi', 'speculative']],
      ['Echoes Under the Monsoon', 'Literary Fiction', ['monsoon', 'family', 'literary', 'memory']],
      ['The Clockmaker Cipher', 'Mystery & Thriller', ['cipher', 'thriller', 'clockwork', 'investigation']],
      ['Starlight Relay Station Nine', 'Sci-Fi', ['deep space', 'relay', 'ai', 'sci-fi']],
      ['The Salt Merchant Daughter', 'Historical Fiction', ['historical', 'harbor', 'family', 'century']],
      ['Lanterns of the Sunken Valley', 'Fantasy', ['fantasy', 'folklore', 'journey', 'magic']],
      ['Paper Boats in Winter Rain', 'Short Stories', ['short stories', 'fiction', 'contemporary', 'vignettes']],
      ['The Silent Archivist', 'Mystery & Thriller', ['library', 'archive', 'mystery', 'secret']],
      ['Meridian of Brass and Steam', 'Sci-Fi', ['steampunk', 'airship', 'invention', 'sci-fi']],
      ['A Garden Across Two Seasons', 'Literary Fiction', ['seasons', 'prose', 'literary', 'reflection']],
      ['The Winter Garrison', 'Historical Fiction', ['historical', 'frontier', 'winter', 'chronicle']],
      ['Tides of the Jade Archipelago', 'Fantasy', ['fantasy', 'islands', 'voyage', 'myth']],
      ['Footsteps on the Iron Bridge', 'Mystery & Thriller', ['noir', 'bridge', 'detective', 'thriller']],
      ['The Memory Weaver', 'Sci-Fi', ['memory', 'future', 'cyberpunk', 'sci-fi']],
      ['Postcards from an Old Railway', 'Short Stories', ['travel', 'railway', 'short stories', 'nostalgia']],
    ],
    viTitles: [
      ['Bến sông chiều cuối thu', 'Literary Fiction', ['tiểu thuyết', 'văn học', 'quê hương', 'ký ức']],
      ['Ngọn hải đăng trên đảo sương mù', 'Mystery & Thriller', ['trinh thám', 'bí ẩn', 'hải đăng', 'điều tra']],
      ['Trạm quỹ đạo bình minh', 'Sci-Fi', ['viễn tưởng', 'vũ trụ', 'tương lai', 'phiêu lưu']],
      ['Biên niên sử phố cổ ven sông', 'Historical Fiction', ['lịch sử', 'phố cổ', 'gia tộc', 'tiểu thuyết']],
      ['Khu rừng của những chiếc đèn lồng', 'Fantasy', ['kỳ ảo', 'phiêu lưu', 'truyền thuyết', 'rừng sâu']],
      ['Những chuyến tàu đi qua mùa mưa', 'Short Stories', ['truyện ngắn', 'tản văn', 'mùa mưa', 'kỷ niệm']],
      ['Bản đồ sao bị thất lạc', 'Mystery & Thriller', ['bí mật', 'thám tử', 'bản đồ', 'hồi hộp']],
      ['Thành phố bên kia dải ngân hà', 'Sci-Fi', ['viễn tưởng', 'ngân hà', 'hành tinh', 'khám phá']],
      ['Gió bấc trên đồi thông cũ', 'Literary Fiction', ['văn học hiện đại', 'tuổi trẻ', 'tình bạn', 'đà lạt']],
      ['Người giữ thư viện tầng áp mái', 'Fantasy', ['thư viện', 'kỳ ảo', 'bí ẩn', 'giả tưởng']],
      ['Mùa gặt ở thung lũng mây', 'Literary Fiction', ['nông thôn', 'miền núi', 'tiểu thuyết', 'đời sống']],
      ['Mật mã chiếc đồng hồ quả lắc', 'Mystery & Thriller', ['mật mã', 'trinh thám', 'suy luận', 'kịch tính']],
      ['Tuyển tập truyện ngắn tuổi hai mươi', 'Short Stories', ['truyện ngắn', 'sinh viên', 'tuổi trẻ', 'tuyển tập']],
    ],
  },
  {
    category: 'Natural Sciences',
    targetCount: 28,
    shelfPrefix: 'Floor 2 • Shelf NS',
    wing: 'East Wing',
    priceRange: [110000, 340000],
    pageRange: [220, 640],
    fields: [
      'Biology', 'Chemistry', 'Ecology', 'Earth Sciences', 'Biotechnology', 'Genetics',
    ],
    enTitles: [
      ['Molecular Cell Biology Essentials', 'Biology', ['cells', 'biology', 'proteins', 'metabolism']],
      ['Organic Synthesis Pathways', 'Chemistry', ['organic', 'reactions', 'synthesis', 'molecules']],
      ['Tropical Forest Ecosystems', 'Ecology', ['ecology', 'biodiversity', 'forests', 'conservation']],
      ['Plate Tectonics and Volcanology', 'Earth Sciences', ['geology', 'tectonics', 'volcanoes', 'earth']],
      ['CRISPR and Genome Engineering', 'Biotechnology', ['crispr', 'genetics', 'biotech', 'dna']],
      ['Microbial Worlds Around Us', 'Biology', ['microbiology', 'bacteria', 'microbiome', 'life']],
      ['Analytical Spectroscopy Techniques', 'Chemistry', ['spectroscopy', 'analytical', 'lab', 'chemistry']],
      ['Marine Biology of Coral Reefs', 'Ecology', ['marine', 'coral', 'oceans', 'ecosystems']],
      ['Principles of Evolutionary Genetics', 'Genetics', ['evolution', 'genetics', 'alleles', 'adaptation']],
      ['Hydrology and Freshwater Systems', 'Earth Sciences', ['water', 'rivers', 'hydrology', 'geoscience']],
      ['Biochemistry of Enzymes', 'Biotechnology', ['enzymes', 'biochemistry', 'kinetics', 'catalysis']],
      ['Botany and Plant Physiology', 'Biology', ['plants', 'botany', 'photosynthesis', 'flora']],
      ['Polymer Materials and Composites', 'Chemistry', ['polymers', 'materials', 'chemistry', 'engineering']],
      ['Soil Science and Sustainable Farming', 'Ecology', ['soil', 'agriculture', 'nutrients', 'ecology']],
      ['Mineralogy and Rock Identification', 'Earth Sciences', ['minerals', 'crystals', 'geology', 'rocks']],
      ['Immunology and Cellular Defense', 'Biology', ['immunology', 'antibodies', 'vaccines', 'health']],
      ['Bioinformatics Sequence Analysis', 'Biotechnology', ['bioinformatics', 'genomics', 'alignment', 'dna']],
    ],
    viTitles: [
      ['Sinh học phân tử và di truyền tế bào', 'Biology', ['sinh học', 'tế bào', 'di truyền', 'phân tử']],
      ['Hệ sinh thái rừng ngập mặn Việt Nam', 'Ecology', ['sinh thái', 'rừng ngập mặn', 'đa dạng sinh học', 'bảo tồn']],
      ['Địa chất đại cương và tài nguyên trầm tích', 'Earth Sciences', ['địa chất', 'đá trầm tích', 'trái đất', 'địa tầng']],
      ['Công nghệ sinh học và ứng dụng y dược', 'Biotechnology', ['công nghệ sinh học', 'y dược', 'enzyme', 'tế bào']],
      ['Vi sinh vật học thực nghiệm', 'Biology', ['vi sinh vật', 'thí nghiệm', 'nấm men', 'sinh học']],
      ['Di truyền học quần thể và chọn lọc tự nhiên', 'Genetics', ['di truyền', 'quần thể', 'chọn lọc', 'gen']],
      ['Thủy văn học và quản lý nguồn nước', 'Earth Sciences', ['thủy văn', 'nguồn nước', 'sông ngòi', 'môi trường']],
      ['Thực vật học nhiệt đới và dược liệu', 'Biology', ['thực vật', 'nhiệt đới', 'dược liệu', 'sinh học']],
      ['Sinh thái biển và bảo tồn rạn san hô', 'Ecology', ['sinh thái biển', 'san hô', 'đại dương', 'bảo tồn']],
      ['Kỹ thuật phân tích quang phổ trong phòng thí nghiệm', 'Chemistry', ['quang phổ', 'phân tích', 'phòng thí nghiệm', 'vật liệu']],
      ['Vật liệu polyme phân hủy sinh học', 'Biotechnology', ['polyme', 'vật liệu mới', 'sinh học', 'môi trường']],
    ],
  },
  {
    category: 'Arts',
    targetCount: 26,
    shelfPrefix: 'Floor 3 • Shelf AR',
    wing: 'West Wing',
    priceRange: [105000, 320000],
    pageRange: [160, 440],
    fields: [
      'Design', 'Architecture', 'Visual Arts', 'Music Theory', 'Film Studies', 'Typography',
    ],
    enTitles: [
      ['Grid Systems in Editorial Layout', 'Typography', ['grids', 'typography', 'layout', 'editorial']],
      ['Sustainable Tropical Architecture', 'Architecture', ['architecture', 'tropical', 'passive cooling', 'buildings']],
      ['Color Theory and Visual Harmony', 'Visual Arts', ['color', 'composition', 'painting', 'aesthetics']],
      ['Harmony and Counterpoint Foundations', 'Music Theory', ['music', 'harmony', 'composition', 'scales']],
      ['Visual Storytelling in Cinema', 'Film Studies', ['cinema', 'cinematography', 'editing', 'film']],
      ['Industrial Design Sketches to Form', 'Design', ['industrial design', 'sketching', 'ergonomics', 'prototypes']],
      ['Modernist Concrete and Light', 'Architecture', ['modernism', 'concrete', 'light', 'spatial']],
      ['Typeface Anatomy and Pairing', 'Typography', ['fonts', 'serif', 'typeface', 'design']],
      ['Watercolor Landscapes and Texture', 'Visual Arts', ['watercolor', 'illustration', 'landscape', 'art']],
      ['Sound Design for Interactive Media', 'Music Theory', ['sound', 'acoustics', 'audio', 'media']],
      ['Documentary Filmmaking Craft', 'Film Studies', ['documentary', 'storytelling', 'directing', 'film']],
      ['Design Systems for Digital Teams', 'Design', ['design systems', 'tokens', 'components', 'ui']],
      ['Timber Joinery and Vernacular Homes', 'Architecture', ['timber', 'craft', 'vernacular', 'architecture']],
      ['Printmaking from Woodblock to Silkscreen', 'Visual Arts', ['printmaking', 'woodblock', 'silkscreen', 'studio']],
      ['Rhythm, Jazz, and Improvisation', 'Music Theory', ['jazz', 'rhythm', 'improvisation', 'music']],
    ],
    viTitles: [
      ['Kiến trúc nhiệt đới đương đại tại Việt Nam', 'Architecture', ['kiến trúc', 'nhiệt đới', 'không gian', 'xây dựng']],
      ['Nghệ thuật chữ và bố cục trang in', 'Typography', ['nghệ thuật chữ', 'bố cục', 'in ấn', 'thiết kế']],
      ['Lý thuyết màu sắc trong thiết kế thị giác', 'Visual Arts', ['màu sắc', 'thị giác', 'mỹ thuật', 'bố cục']],
      ['Nhạc lý cơ bản và phối khí hiện đại', 'Music Theory', ['nhạc lý', 'âm nhạc', 'phối khí', 'giai điệu']],
      ['Ngôn ngữ điện ảnh và nghệ thuật dựng phim', 'Film Studies', ['điện ảnh', 'dựng phim', 'kịch bản', 'góc quay']],
      ['Thiết kế sản phẩm công nghiệp và công thái học', 'Design', ['thiết kế sản phẩm', 'công thái học', 'sáng tạo', 'mẫu']],
      ['Di sản kiến trúc gỗ truyền thống miền Trung', 'Architecture', ['kiến trúc gỗ', 'di sản', 'miền trung', 'truyền thống']],
      ['Kỹ thuật phác thảo và vẽ màu nước', 'Visual Arts', ['phác thảo', 'màu nước', 'hội vẽ', 'mỹ thuật']],
      ['Thiết kế nhận diện thương hiệu toàn diện', 'Design', ['thương hiệu', 'logo', 'nhận diện', 'thiết kế']],
      ['Lịch sử mỹ thuật Đông Dương thế kỷ hai mươi', 'Visual Arts', ['mỹ thuật', 'lịch sử', 'tranh lụa', 'sơn mài']],
      ['Âm thanh và ánh sáng trong sân khấu đương đại', 'Film Studies', ['sân khấu', 'ánh sáng', 'âm thanh', 'nghệ thuật']],
    ],
  },
]

function buildDescription(book) {
  if (book.language === 'Vietnamese') {
    return `${book.title} cung cấp kiến thức hệ thống và các ví dụ thực tiễn trong lĩnh vực ${book.field}, phù hợp cho sinh viên đại học, giảng viên và bạn đọc nghiên cứu chuyên sâu tại Thư viện ShelfHelp.`
  }
  return `${book.title} offers a structured, practical exploration of ${book.field} with worked examples, reference models, and study exercises curated for university readers at ShelfHelp Library.`
}

function buildToc(book) {
  if (book.language === 'Vietnamese') {
    return `1. Tổng quan về ${book.field}\n2. Nền tảng lý thuyết và phương pháp luận\n3. Phân tích tình huống thực tế\n4. Bài tập ứng dụng và tài liệu tham khảo`
  }
  return `1. Foundations of ${book.field}\n2. Core Principles and Frameworks\n3. Applied Case Studies\n4. Practice Problems and Further Reading`
}

function generateCatalog() {
  const rng = createRng(20261127)
  const books = []
  const usedIsbns = new Set(EXISTING_ISBN13)
  const usedTitles = new Set(EXISTING_TITLES_LOWER)

  let globalIndex = 0

  for (const spec of CATEGORY_SPECS) {
    const combined = [
      ...spec.enTitles.map(([title, field, keywords]) => ({ title, field, keywords, language: 'English' })),
      ...spec.viTitles.map(([title, field, keywords]) => ({ title, field, keywords, language: 'Vietnamese' })),
    ]

    if (combined.length !== spec.targetCount) {
      throw new Error(
        `Category "${spec.category}" has ${combined.length} entries, expected ${spec.targetCount}`,
      )
    }

    for (let i = 0; i < combined.length; i += 1) {
      globalIndex += 1
      const entry = combined[i]
      const isVi = entry.language === 'Vietnamese'
      const authorPool = isVi ? VI_AUTHORS : EN_AUTHORS
      const pubPool = isVi ? VI_PUBLISHERS[spec.category] : EN_PUBLISHERS[spec.category]

      const authorCount = rng() < 0.28 ? 2 : 1
      const authors = []
      while (authors.length < authorCount) {
        const candidate = authorPool[Math.floor(rng() * authorPool.length)]
        if (!authors.includes(candidate)) authors.push(candidate)
      }

      // Deterministic valid EAN-13 ISBN (978-604-81xxxx or 978-1-9681xxxx)
      const isbnPrefix12 = isVi
        ? `97860481${String(globalIndex).padStart(4, '0')}`
        : `97819681${String(globalIndex).padStart(4, '0')}`
      const isbn13 = buildIsbn13(isbnPrefix12)
      const isbn10 = toIsbn10(isbn13)

      const publisher = pubPool[Math.floor(rng() * pubPool.length)]
      const year = 1998 + Math.floor(rng() * 29) // 1998..2026
      const [minP, maxP] = spec.pageRange
      const pages = Math.round((minP + rng() * (maxP - minP)) / 8) * 8

      const [minVnd, maxVnd] = spec.priceRange
      const replacementPrice = Math.round((minVnd + rng() * (maxVnd - minVnd)) / 5000) * 5000

      const collection = rng() < 0.30 ? 'premium' : 'standard'
      const shelfSlot = String((i % 12) + 1).padStart(2, '0')
      const shelfLocation = `${spec.shelfPrefix}-${shelfSlot} (${spec.wing})`

      // 8 draft books spread across categories (indices 23, 47, 71, 95, 119, 143, 167, 190)
      const isDraft = globalIndex % 24 === 23 || globalIndex === 190
      const status = isDraft ? 'draft' : 'active'

      // Keep popularity strictly <= 86.5 so Figma showcase titles (88..98.5) stay in Popular This Week
      const ratingAvg = Number((3.75 + rng() * 1.15).toFixed(2))
      const ratingCount = isDraft ? 0 : 6 + Math.floor(rng() * 165)
      const borrowCount = isDraft ? 0 : 3 + Math.floor(rng() * 78)
      const popularityScore = isDraft
        ? 0
        : Number((28 + rng() * 58).toFixed(1))

      // Stagger added_at across the past 360 days
      const daysAgo = 2 + Math.floor((globalIndex * 1.85) % 355)

      const book = {
        seq: globalIndex,
        title: entry.title,
        authors,
        isbn10,
        isbn13,
        publisher,
        year,
        pages,
        language: entry.language,
        category: spec.category,
        field: entry.field,
        keywords: entry.keywords,
        collection,
        replacement_price: replacementPrice,
        shelf_location: shelfLocation,
        status,
        rating_avg: ratingAvg,
        rating_count: ratingCount,
        borrow_count: borrowCount,
        popularity_score: popularityScore,
        days_ago: daysAgo,
      }
      book.description = buildDescription(book)
      book.toc = buildToc(book)

      books.push(book)
      usedIsbns.add(isbn13)
      usedTitles.add(entry.title.toLowerCase())
    }
  }

  // Generate physical copies for all 191 books (~510 copies)
  const copies = []
  let barcodeSeq = 20000

  // Pick 14 active books to have 0 available copies (for Reader "Reserve Copy" testing)
  const activeBooks = books.filter((b) => b.status === 'active')
  const outOfStockSeqs = new Set()
  for (let idx = 4; idx < activeBooks.length && outOfStockSeqs.size < 14; idx += 13) {
    outOfStockSeqs.add(activeBooks[idx].seq)
  }

  for (const book of books) {
    const isOutOfStock = outOfStockSeqs.has(book.seq)
    const copyCount = book.status === 'draft'
      ? (book.seq % 2 === 0 ? 2 : 1)
      : isOutOfStock
        ? 2
        : 2 + Math.floor(rng() * 3) // 2..4 copies

    for (let c = 0; c < copyCount; c += 1) {
      barcodeSeq += 1
      const barcode = `BK-${barcodeSeq}`

      let status = 'available'
      let condition = 'good'
      let heldForType = null
      let heldHours = null

      if (book.status === 'draft') {
        status = 'available'
        condition = c === 0 ? 'good' : 'fair'
      } else if (isOutOfStock) {
        if (c === 0) {
          status = 'borrowed'
          condition = 'good'
        } else {
          const cycle = book.seq % 3
          if (cycle === 0) {
            status = 'borrowed'
            condition = 'fair'
          } else if (cycle === 1) {
            status = 'held'
            condition = 'good'
            heldForType = 'reservation'
            heldHours = 24
          } else {
            status = 'under_repair'
            condition = 'poor'
          }
        }
      } else if (c === 0) {
        // Guarantee at least 1 available copy on normal active titles
        status = 'available'
        condition = rng() < 0.85 ? 'good' : 'fair'
      } else {
        const roll = rng()
        if (roll < 0.68) {
          status = 'available'
          condition = roll < 0.52 ? 'good' : 'fair'
        } else if (roll < 0.82) {
          status = 'borrowed'
          condition = roll < 0.77 ? 'good' : 'fair'
        } else if (roll < 0.86) {
          status = 'held'
          condition = 'good'
          heldForType = 'reservation'
          heldHours = 36
        } else if (roll < 0.91) {
          status = 'damaged'
          condition = 'damaged'
        } else if (roll < 0.95) {
          status = 'under_repair'
          condition = 'poor'
        } else if (roll < 0.975) {
          status = 'lost'
          condition = 'poor'
        } else {
          status = 'retired'
          condition = 'damaged'
        }
      }

      const sourceRoll = rng()
      const sourceType = sourceRoll < 0.68
        ? 'batch'
        : sourceRoll < 0.88
          ? 'purchase_outside_batch'
          : 'donation'

      copies.push({
        book_isbn13: book.isbn13,
        barcode,
        status,
        shelf_location: book.shelf_location,
        condition,
        source_type: sourceType,
        held_for_type: heldForType,
        held_hours: heldHours,
      })
    }
  }

  return { books, copies, outOfStockCount: outOfStockSeqs.size }
}

function validateCatalog({ books, copies }) {
  const errors = []
  if (books.length !== GENERATED_BOOK_COUNT) {
    errors.push(`Expected ${GENERATED_BOOK_COUNT} generated books, got ${books.length}`)
  }

  const seenIsbn = new Set(EXISTING_ISBN13)
  const seenTitles = new Set(EXISTING_TITLES_LOWER)
  const seenBarcodes = new Set()

  for (const b of books) {
    if (!validateIsbn13(b.isbn13)) errors.push(`Invalid ISBN-13 checksum: ${b.isbn13} (${b.title})`)
    if (seenIsbn.has(b.isbn13)) errors.push(`Duplicate ISBN-13: ${b.isbn13}`)
    seenIsbn.add(b.isbn13)

    const lowerTitle = b.title.toLowerCase()
    if (seenTitles.has(lowerTitle)) errors.push(`Duplicate title: ${b.title}`)
    seenTitles.add(lowerTitle)

    // rls_test.sql guard: `where title like '% Book'`
    if (/\bbook$/i.test(b.title.trim())) {
      errors.push(`Title ends with "Book" (collides with rls_test.sql): ${b.title}`)
    }

    // TS-08 guard: `immutable_unaccent('hoa')` should only match the 3 original Vietnamese fixtures
    const searchable = [b.title, ...b.authors, ...b.keywords].join(' ')
    if (stripDiacritics(searchable).includes('hoa')) {
      errors.push(`Book contains "hoa" after unaccent (collides with TS-08): ${b.title} -> ${searchable}`)
    }

    // books.spec.ts guards
    if (lowerTitle.includes('dune')) {
      errors.push(`Title contains "dune" (collides with books.spec.ts): ${b.title}`)
    }
    if (lowerTitle.includes('brief history')) {
      errors.push(`Title contains "brief history" (collides with books.spec.ts): ${b.title}`)
    }
  }

  const statusSet = new Set()
  const condSet = new Set()
  const sourceSet = new Set()
  for (const c of copies) {
    if (seenBarcodes.has(c.barcode)) errors.push(`Duplicate barcode: ${c.barcode}`)
    seenBarcodes.add(c.barcode)
    statusSet.add(c.status)
    condSet.add(c.condition)
    sourceSet.add(c.source_type)
  }

  for (const reqStatus of ['available', 'held', 'borrowed', 'damaged', 'under_repair', 'lost', 'retired']) {
    if (!statusSet.has(reqStatus)) errors.push(`Missing copy status coverage: ${reqStatus}`)
  }
  for (const reqCond of ['good', 'fair', 'poor', 'damaged']) {
    if (!condSet.has(reqCond)) errors.push(`Missing copy condition coverage: ${reqCond}`)
  }

  if (errors.length > 0) {
    throw new Error(`Seed validation failed (${errors.length} error(s)):\n- ${errors.join('\n- ')}`)
  }
}

function sqlStr(val) {
  if (val === null || val === undefined) return 'null'
  return `'${String(val).replace(/'/g, "''")}'`
}

function sqlTextArray(arr) {
  if (!arr || arr.length === 0) return `array[]::text[]`
  return `array[${arr.map((v) => sqlStr(v)).join(', ')}]`
}

function renderSqlBlock({ books, copies }) {
  const lines = []
  lines.push(BEGIN_MARKER)
  lines.push('-- 191 synthetic books (+ 9 existing fixtures = 200 total titles, SRS §10.6)')
  lines.push('insert into public.books (')
  lines.push('  title, authors, isbn10, isbn13, publisher, year, pages, language, category, field,')
  lines.push('  description, toc, keywords, collection, replacement_price, shelf_location, status,')
  lines.push('  rating_avg, rating_count, popularity_score, borrow_count, added_at')
  lines.push(')')
  lines.push('values')

  const bookRows = books.map((b, idx) => {
    const comma = idx === books.length - 1 ? '' : ','
    return `  (${sqlStr(b.title)}, ${sqlTextArray(b.authors)}, ${sqlStr(b.isbn10)}, ${sqlStr(b.isbn13)}, ${sqlStr(b.publisher)}, ${b.year}, ${b.pages}, ${sqlStr(b.language)}, ${sqlStr(b.category)}, ${sqlStr(b.field)}, ${sqlStr(b.description)}, ${sqlStr(b.toc)}, ${sqlTextArray(b.keywords)}, ${sqlStr(b.collection)}, ${b.replacement_price}, ${sqlStr(b.shelf_location)}, ${sqlStr(b.status)}, ${b.rating_avg.toFixed(2)}, ${b.rating_count}, ${b.popularity_score.toFixed(1)}, ${b.borrow_count}, now() - interval '${b.days_ago} days')${comma}`
  })
  lines.push(...bookRows)
  lines.push('on conflict (isbn13) where isbn13 is not null do nothing;')
  lines.push('')

  // Split copies by inventory transaction provenance so Admin History quick filters all have data
  const batchCopies = copies.filter((c) => c.source_type === 'batch' && !['lost', 'retired', 'damaged', 'under_repair'].includes(c.status))
  const manualCopies = copies.filter((c) => c.source_type !== 'batch' && !['lost', 'retired', 'damaged', 'under_repair'].includes(c.status))
  const transitionCopies = copies.filter((c) => ['damaged', 'under_repair', 'lost', 'retired'].includes(c.status))

  const pushCopyInsert = (subset, invType, invReason) => {
    if (subset.length === 0) return
    lines.push(`do $$`)
    lines.push(`begin`)
    lines.push(`  perform set_config('app.inventory_actor', '${ADMIN_ACTOR_ID}', true);`)
    lines.push(`  perform set_config('app.inventory_type', '${invType}', true);`)
    lines.push(`  perform set_config('app.inventory_reason', ${sqlStr(invReason)}, true);`)
    lines.push(`  insert into public.copies (book_id, barcode, status, shelf_location, condition, source_type, held_for_type, held_until)`)
    lines.push(`  select b.id, v.barcode, v.status, v.shelf_location, v.condition, v.source_type, v.held_for_type,`)
    lines.push(`         case when v.held_hours is not null then now() + make_interval(hours => v.held_hours) else null end`)
    lines.push(`  from (values`)
    subset.forEach((c, idx) => {
      const comma = idx === subset.length - 1 ? '' : ','
      const heldType = c.held_for_type ? sqlStr(c.held_for_type) : 'null::text'
      const heldHours = c.held_hours !== null ? `${c.held_hours}::int` : 'null::int'
      lines.push(`    (${sqlStr(c.book_isbn13)}, ${sqlStr(c.barcode)}, ${sqlStr(c.status)}, ${sqlStr(c.shelf_location)}, ${sqlStr(c.condition)}, ${sqlStr(c.source_type)}, ${heldType}, ${heldHours})${comma}`)
    })
    lines.push(`  ) as v(isbn13, barcode, status, shelf_location, condition, source_type, held_for_type, held_hours)`)
    lines.push(`  join public.books b on b.isbn13 = v.isbn13`)
    lines.push(`  on conflict (barcode) do nothing;`)
    lines.push(`end $$;`)
    lines.push('')
  }

  lines.push('-- Physical copies (batch receipts -> Admin History: Batch receipts)')
  pushCopyInsert(batchCopies, 'batch_receipt', 'Initial catalog batch receipt (SCRUM-81)')

  lines.push('-- Physical copies (manual acquisitions & donations -> Admin History: Manual additions)')
  pushCopyInsert(manualCopies, 'manual_addition', 'Catalog acquisition outside batch (SCRUM-81)')

  // Insert transition copies first as 'available' then transition them so History logs status_change / write_off / lost
  if (transitionCopies.length > 0) {
    lines.push('-- Physical copies with lifecycle transitions (Admin History: Status changes & Stock reductions)')
    lines.push('do $$')
    lines.push('begin')
    lines.push(`  perform set_config('app.inventory_actor', '${ADMIN_ACTOR_ID}', true);`)
    lines.push(`  perform set_config('app.inventory_type', 'batch_receipt', true);`)
    lines.push(`  perform set_config('app.inventory_reason', 'Initial catalog batch receipt (SCRUM-81)', true);`)
    lines.push('  insert into public.copies (book_id, barcode, status, shelf_location, condition, source_type)')
    lines.push('  select b.id, v.barcode, \'available\', v.shelf_location, \'good\', v.source_type')
    lines.push('  from (values')
    transitionCopies.forEach((c, idx) => {
      const comma = idx === transitionCopies.length - 1 ? '' : ','
      lines.push(`    (${sqlStr(c.book_isbn13)}, ${sqlStr(c.barcode)}, ${sqlStr(c.shelf_location)}, ${sqlStr(c.source_type)})${comma}`)
    })
    lines.push('  ) as v(isbn13, barcode, shelf_location, source_type)')
    lines.push('  join public.books b on b.isbn13 = v.isbn13')
    lines.push('  on conflict (barcode) do nothing;')
    lines.push('')

    const groups = [
      { status: 'damaged', condition: 'damaged', invType: 'status_change', reason: 'Shelf audit: cover or binding damaged' },
      { status: 'under_repair', condition: 'poor', invType: 'status_change', reason: 'Routed to conservation bench for rebinding' },
      { status: 'lost', condition: 'poor', invType: 'lost', reason: 'Confirmed missing during semester inventory audit' },
      { status: 'retired', condition: 'damaged', invType: 'write_off', reason: 'Retired due to wear beyond repair' },
    ]
    for (const g of groups) {
      const barcodes = transitionCopies.filter((c) => c.status === g.status).map((c) => sqlStr(c.barcode))
      if (barcodes.length === 0) continue
      lines.push(`  perform set_config('app.inventory_type', '${g.invType}', true);`)
      lines.push(`  perform set_config('app.inventory_reason', ${sqlStr(g.reason)}, true);`)
      lines.push(`  update public.copies`)
      lines.push(`  set status = '${g.status}', condition = '${g.condition}'`)
      lines.push(`  where barcode in (${barcodes.join(', ')}) and status = 'available';`)
      lines.push('')
    }
    lines.push('end $$;')
  }

  lines.push(END_MARKER)
  return lines.join('\n')
}

function updateSeedSql(sqlBlock) {
  const existing = fs.readFileSync(SEED_SQL_PATH, 'utf8').replace(/\r\n/g, '\n')
  const startIdx = existing.indexOf('-- BEGIN GENERATED BOOK SEED (SCRUM-81)')
  let base
  if (startIdx !== -1) {
    // Walk back to include the preceding separator line
    const sepStart = existing.lastIndexOf('-- =============================================================================', startIdx)
    base = existing.slice(0, sepStart !== -1 ? sepStart : startIdx).trimEnd()
  } else {
    base = existing.trimEnd()
  }
  const updated = `${base}\n\n${sqlBlock}\n`
  fs.writeFileSync(SEED_SQL_PATH, updated, 'utf8')
}

function writeSampleCsv(csvPath, books) {
  const header = 'title,authors,isbn13,isbn10,publisher,year,language,category,field,collection,replacement_price,shelf_location,copies,description'
  const escapeCsv = (v) => {
    const s = String(v ?? '')
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const sample = books.slice(0, 25).map((b) =>
    [
      b.title,
      b.authors.join('; '),
      b.isbn13,
      b.isbn10 || '',
      b.publisher,
      b.year,
      b.language,
      b.category,
      b.field,
      b.collection,
      b.replacement_price,
      b.shelf_location,
      2,
      b.description,
    ]
      .map(escapeCsv)
      .join(','),
  )
  fs.writeFileSync(csvPath, `${header}\n${sample.join('\n')}\n`, 'utf8')
}

function summarize({ books, copies, outOfStockCount }) {
  const byCategory = {}
  const byLanguage = {}
  const byCollection = {}
  const byBookStatus = {}
  for (const b of books) {
    byCategory[b.category] = (byCategory[b.category] || 0) + 1
    byLanguage[b.language] = (byLanguage[b.language] || 0) + 1
    byCollection[b.collection] = (byCollection[b.collection] || 0) + 1
    byBookStatus[b.status] = (byBookStatus[b.status] || 0) + 1
  }
  const byCopyStatus = {}
  const byCondition = {}
  for (const c of copies) {
    byCopyStatus[c.status] = (byCopyStatus[c.status] || 0) + 1
    byCondition[c.condition] = (byCondition[c.condition] || 0) + 1
  }
  console.log(`Seed catalog validated successfully:`)
  console.log(`  Books: ${books.length} generated (+ ${EXISTING_BOOK_COUNT} existing = ${books.length + EXISTING_BOOK_COUNT} total)`)
  console.log(`  Book statuses:`, byBookStatus)
  console.log(`  Categories:`, byCategory)
  console.log(`  Languages:`, byLanguage)
  console.log(`  Collections:`, byCollection)
  console.log(`  Active out-of-stock titles (Reserve-ready): ${outOfStockCount}`)
  console.log(`  Copies generated: ${copies.length}`)
  console.log(`  Copy statuses:`, byCopyStatus)
  console.log(`  Copy conditions:`, byCondition)
}

function main() {
  const args = process.argv.slice(2)
  const checkOnly = args.includes('--check')
  const csvIdx = args.indexOf('--csv')

  const data = generateCatalog()
  validateCatalog(data)
  summarize(data)

  if (!checkOnly) {
    const sqlBlock = renderSqlBlock(data)
    updateSeedSql(sqlBlock)
    console.log(`\nUpdated ${path.relative(REPO_ROOT, SEED_SQL_PATH)} (${sqlBlock.split('\n').length} SQL lines).`)
  }

  if (csvIdx !== -1 && args[csvIdx + 1]) {
    const targetCsv = path.resolve(process.cwd(), args[csvIdx + 1])
    writeSampleCsv(targetCsv, data.books)
    console.log(`Exported sample CSV to ${targetCsv}`)
  }
}

main()
