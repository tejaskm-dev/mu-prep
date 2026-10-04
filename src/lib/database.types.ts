// Types for the schema in supabase/migrations. Keep in sync when the SQL changes
// (or regenerate with `npx supabase gen types typescript --project-id <id>`).

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type ResourceType = "notes" | "pyq" | "lab" | "assignment" | "qbank" | "syllabus" | "other";
export type ResourceStatus = "published" | "draft" | "pending" | "rejected";

type ResourceColumns = {
  id: string;
  subject_id: string;
  title: string;
  description: string | null;
  type: ResourceType;
  module: number | null;
  tags: string[];
  exam_year: number | null;
  exam_session: string | null;
  author: string | null;
  is_verified: boolean;
  is_featured: boolean;
  status: ResourceStatus;
  file_key: string | null;
  file_url: string | null;
  file_name: string | null;
  file_size: number | null;
  mime_type: string | null;
  file_hash: string | null;
  page_count: number | null;
  thumbnail_key: string | null;
  thumbnail_url: string | null;
  external_url: string | null;
  contributor_name: string | null;
  view_count: number;
  download_count: number;
  created_by: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

type SubjectColumns = {
  id: string;
  slug: string;
  name: string;
  short_name: string | null;
  code: string | null;
  semester: number;
  description: string | null;
  icon: string;
  credits: number | null;
  modules: Json;
  keywords: string[];
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type ResourceFeedRow = ResourceColumns & {
  subject_name: string;
  subject_short_name: string | null;
  subject_slug: string;
  subject_code: string | null;
  subject_icon: string;
  semester: number;
  department_slugs: string[];
};

export type SubjectOverviewRow = SubjectColumns & {
  department_slugs: string[];
  department_ids: string[];
  resource_count: number;
  notes_count: number;
  pyq_count: number;
  download_count: number;
  last_published_at: string | null;
};

type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

export type Database = {
  public: {
    Tables: {
      admins: {
        Row: { user_id: string; email: string; role: "owner" | "editor"; created_at: string };
        Insert: { user_id: string; email: string; role?: "owner" | "editor"; created_at?: string };
        Update: { user_id?: string; email?: string; role?: "owner" | "editor"; created_at?: string };
        Relationships: [];
      };
      departments: {
        Row: {
          id: string;
          slug: string;
          code: string;
          name: string;
          icon: string;
          sort_order: number;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          code: string;
          name: string;
          icon?: string;
          sort_order?: number;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          slug?: string;
          code?: string;
          name?: string;
          icon?: string;
          sort_order?: number;
          is_active?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      subjects: {
        Row: SubjectColumns;
        Insert: Optional<
          SubjectColumns,
          | "id"
          | "short_name"
          | "code"
          | "description"
          | "icon"
          | "credits"
          | "modules"
          | "keywords"
          | "is_active"
          | "sort_order"
          | "created_at"
          | "updated_at"
        >;
        Update: Partial<SubjectColumns>;
        Relationships: [];
      };
      subject_departments: {
        Row: { subject_id: string; department_id: string };
        Insert: { subject_id: string; department_id: string };
        Update: { subject_id?: string; department_id?: string };
        Relationships: [
          {
            foreignKeyName: "subject_departments_subject_id_fkey";
            columns: ["subject_id"];
            isOneToOne: false;
            referencedRelation: "subjects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "subject_departments_department_id_fkey";
            columns: ["department_id"];
            isOneToOne: false;
            referencedRelation: "departments";
            referencedColumns: ["id"];
          },
        ];
      };
      resources: {
        Row: ResourceColumns & { fts: unknown };
        Insert: Optional<
          ResourceColumns,
          | "id"
          | "description"
          | "type"
          | "module"
          | "tags"
          | "exam_year"
          | "exam_session"
          | "author"
          | "is_verified"
          | "is_featured"
          | "status"
          | "file_key"
          | "file_url"
          | "file_name"
          | "file_size"
          | "mime_type"
          | "file_hash"
          | "page_count"
          | "thumbnail_key"
          | "thumbnail_url"
          | "external_url"
          | "contributor_name"
          | "view_count"
          | "download_count"
          | "created_by"
          | "published_at"
          | "created_at"
          | "updated_at"
        >;
        Update: Partial<ResourceColumns>;
        Relationships: [
          {
            foreignKeyName: "resources_subject_id_fkey";
            columns: ["subject_id"];
            isOneToOne: false;
            referencedRelation: "subjects";
            referencedColumns: ["id"];
          },
        ];
      };
      submission_details: {
        Row: {
          resource_id: string;
          contributor_contact: string | null;
          contributor_note: string | null;
          ip_hash: string | null;
          created_at: string;
        };
        Insert: {
          resource_id: string;
          contributor_contact?: string | null;
          contributor_note?: string | null;
          ip_hash?: string | null;
          created_at?: string;
        };
        Update: {
          resource_id?: string;
          contributor_contact?: string | null;
          contributor_note?: string | null;
          ip_hash?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "submission_details_resource_id_fkey";
            columns: ["resource_id"];
            isOneToOne: true;
            referencedRelation: "resources";
            referencedColumns: ["id"];
          },
        ];
      };
      resource_events: {
        Row: { id: number; resource_id: string; kind: "view" | "download"; created_at: string };
        Insert: { id?: number; resource_id: string; kind: "view" | "download"; created_at?: string };
        Update: { id?: number; resource_id?: string; kind?: "view" | "download"; created_at?: string };
        Relationships: [
          {
            foreignKeyName: "resource_events_resource_id_fkey";
            columns: ["resource_id"];
            isOneToOne: false;
            referencedRelation: "resources";
            referencedColumns: ["id"];
          },
        ];
      };
      note_requests: {
        Row: {
          id: string;
          subject_id: string;
          type: ResourceType | null;
          module: number | null;
          message: string | null;
          status: "open" | "fulfilled" | "dismissed";
          ip_hash: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          subject_id: string;
          type?: ResourceType | null;
          module?: number | null;
          message?: string | null;
          status?: "open" | "fulfilled" | "dismissed";
          ip_hash?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          subject_id?: string;
          type?: ResourceType | null;
          module?: number | null;
          message?: string | null;
          status?: "open" | "fulfilled" | "dismissed";
          ip_hash?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "note_requests_subject_id_fkey";
            columns: ["subject_id"];
            isOneToOne: false;
            referencedRelation: "subjects";
            referencedColumns: ["id"];
          },
        ];
      };
      reports: {
        Row: {
          id: string;
          resource_id: string;
          reason: ReportReason;
          message: string | null;
          status: "open" | "resolved" | "dismissed";
          ip_hash: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          resource_id: string;
          reason: ReportReason;
          message?: string | null;
          status?: "open" | "resolved" | "dismissed";
          ip_hash?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          resource_id?: string;
          reason?: ReportReason;
          message?: string | null;
          status?: "open" | "resolved" | "dismissed";
          ip_hash?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "reports_resource_id_fkey";
            columns: ["resource_id"];
            isOneToOne: false;
            referencedRelation: "resources";
            referencedColumns: ["id"];
          },
        ];
      };
      search_logs: {
        Row: { id: number; query: string; results: number; created_at: string };
        Insert: { id?: number; query: string; results?: number; created_at?: string };
        Update: { id?: number; query?: string; results?: number; created_at?: string };
        Relationships: [];
      };
      site_settings: {
        Row: SiteSettingsColumns;
        Insert: Partial<SiteSettingsColumns>;
        Update: Partial<SiteSettingsColumns>;
        Relationships: [];
      };
    };
    Views: {
      subject_overview: {
        Row: SubjectOverviewRow;
        Relationships: [];
      };
      resource_feed: {
        Row: ResourceFeedRow;
        Relationships: [];
      };
    };
    Functions: {
      is_admin: { Args: Record<PropertyKey, never>; Returns: boolean };
      search_resources: {
        Args: {
          q: string;
          p_department?: string | null;
          p_semester?: number | null;
          p_type?: ResourceType | null;
          p_boost_department?: string | null;
          p_boost_semester?: number | null;
          p_limit?: number;
        };
        Returns: ResourceFeedRow[];
      };
      search_subjects: {
        Args: {
          q: string;
          p_department?: string | null;
          p_semester?: number | null;
          p_boost_department?: string | null;
          p_boost_semester?: number | null;
          p_limit?: number;
        };
        Returns: SubjectOverviewRow[];
      };
      trending_resources: {
        Args: { p_days?: number; p_department?: string | null; p_semester?: number | null; p_limit?: number };
        Returns: ResourceFeedRow[];
      };
      track_resource_event: {
        Args: { p_resource_id: string; p_kind: "view" | "download" };
        Returns: undefined;
      };
      admin_daily_stats: {
        Args: { p_days?: number; p_tz?: string };
        Returns: { day: string; downloads: number; views: number; uploads: number }[];
      };
      admin_top_resources: {
        Args: { p_days?: number; p_limit?: number };
        Returns: { id: string; title: string; subject_name: string; downloads: number; views: number }[];
      };
      admin_search_insights: {
        Args: { p_days?: number; p_limit?: number };
        Returns: { query: string; searches: number; zero_results: boolean }[];
      };
    };
    Enums: {
      resource_type: ResourceType;
      resource_status: ResourceStatus;
    };
    CompositeTypes: Record<string, never>;
  };
};

export type ReportReason =
  | "broken"
  | "wrong_subject"
  | "wrong_info"
  | "low_quality"
  | "duplicate"
  | "copyright"
  | "other";

type SiteSettingsColumns = {
  id: boolean;
  college_name: string;
  hero_image_url: string | null;
  hero_image_key: string | null;
  hero_note: string;
  announcement: string | null;
  announcement_link: string | null;
  announcement_enabled: boolean;
  contributions_enabled: boolean;
  requests_enabled: boolean;
  updated_at: string;
};

export type Tables<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Row"];
export type Department = Tables<"departments">;
export type Subject = Tables<"subjects">;
export type SiteSettings = Tables<"site_settings">;
export type NoteRequest = Tables<"note_requests">;
export type Report = Tables<"reports">;
export type AdminRow = Tables<"admins">;
export type SubjectModule = { n: number; title: string };
