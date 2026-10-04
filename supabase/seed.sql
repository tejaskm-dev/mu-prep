-- =============================================================================
-- µPrep — starter data
-- Departments and the common first-semester subjects. Everything here can be
-- edited, extended (Admin → Subjects → Bulk add) or removed from the admin panel.
-- Safe to run more than once.
-- =============================================================================

insert into public.departments (slug, code, name, icon, sort_order) values
  ('cse',   'CSE',     'Computer Science & Engineering',          'laptop',     1),
  ('ece',   'ECE',     'Electronics & Communication Engineering', 'cpu',        2),
  ('eee',   'EEE',     'Electrical & Electronics Engineering',    'zap',        3),
  ('me',    'ME',      'Mechanical Engineering',                  'cog',        4),
  ('ce',    'CE',      'Civil Engineering',                       'building-2', 5),
  ('ai-ds', 'AI & DS', 'Artificial Intelligence & Data Science',  'network',    6)
on conflict (slug) do nothing;

insert into public.subjects (slug, name, short_name, semester, icon, sort_order, keywords, modules) values
  ('engineering-mathematics-1', 'Engineering Mathematics I', 'Mathematics', 1, 'sigma', 1,
    '{maths,math,m1,calculus,"linear algebra"}',
    '[{"n":1,"title":"Sets, Relations and Functions"},{"n":2,"title":"Matrices and Linear Algebra"},{"n":3,"title":"Differential Calculus"},{"n":4,"title":"Integral Calculus"},{"n":5,"title":"Vector Calculus"}]'),
  ('engineering-physics', 'Engineering Physics', 'Physics', 1, 'atom', 2,
    '{physics,phy}',
    '[{"n":1,"title":"Oscillations and Waves"},{"n":2,"title":"Mechanics"},{"n":3,"title":"Wave Optics"},{"n":4,"title":"Quantum Mechanics"},{"n":5,"title":"Lasers and Fibre Optics"}]'),
  ('engineering-chemistry', 'Engineering Chemistry', 'Chemistry', 1, 'flask-conical', 3,
    '{chemistry,chem}',
    '[{"n":1,"title":"Basic Concepts"},{"n":2,"title":"Electrochemistry"},{"n":3,"title":"Spectroscopy"},{"n":4,"title":"Polymer Chemistry"},{"n":5,"title":"Water Technology"}]'),
  ('programming-for-problem-solving', 'Programming for Problem Solving', 'Programming', 1, 'code-xml', 4,
    '{c,"c programming",pps,programming,coding}',
    '[{"n":1,"title":"Introduction to C"},{"n":2,"title":"Control Structures"},{"n":3,"title":"Arrays and Strings"},{"n":4,"title":"Functions and Pointers"},{"n":5,"title":"Structures and File Handling"}]'),
  ('basic-electrical-engineering', 'Basic Electrical Engineering', 'Electrical', 1, 'zap', 5,
    '{bee,electrical,circuits}',
    '[{"n":1,"title":"DC Circuits"},{"n":2,"title":"AC Fundamentals"},{"n":3,"title":"Electrical Machines"},{"n":4,"title":"Power Systems"},{"n":5,"title":"Electrical Safety"}]'),
  ('engineering-graphics', 'Engineering Graphics', 'Graphics', 1, 'box', 6,
    '{eg,graphics,drawing,"engineering drawing"}',
    '[{"n":1,"title":"Orthographic Projections"},{"n":2,"title":"Projections of Solids"},{"n":3,"title":"Sections of Solids"},{"n":4,"title":"Development of Surfaces"},{"n":5,"title":"Isometric Projections"}]'),
  ('communicative-english', 'Communicative English', 'English', 1, 'book-open', 7,
    '{english,communication}',
    '[{"n":1,"title":"Listening Skills"},{"n":2,"title":"Speaking Skills"},{"n":3,"title":"Reading Skills"},{"n":4,"title":"Writing Skills"},{"n":5,"title":"Professional Communication"}]'),
  ('environmental-studies', 'Environmental Studies', 'Environment', 1, 'leaf', 8,
    '{evs,environment,ecology}',
    '[{"n":1,"title":"Ecosystems"},{"n":2,"title":"Biodiversity"},{"n":3,"title":"Pollution"},{"n":4,"title":"Natural Resources"},{"n":5,"title":"Sustainable Development"}]')
on conflict (slug) do nothing;

-- First-semester subjects are common to every department.
insert into public.subject_departments (subject_id, department_id)
select s.id, d.id
from public.subjects s
cross join public.departments d
where s.slug in (
  'engineering-mathematics-1', 'engineering-physics', 'engineering-chemistry',
  'programming-for-problem-solving', 'basic-electrical-engineering', 'engineering-graphics',
  'communicative-english', 'environmental-studies'
)
on conflict do nothing;
