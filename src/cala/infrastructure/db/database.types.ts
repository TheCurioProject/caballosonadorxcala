// Generated from versioned migrations using PostgreSQL. Regenerate with npm run db:types.
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];
export interface Database {
  public: {
    Tables: {
      amenities: {
        Row: {
          id: string;
          key: string;
          category: string;
          label_i18n: Json;
        };
        Insert: Partial<Database["public"]["Tables"]["amenities"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["amenities"]["Row"]>;
        Relationships: [];
      };
      audit_logs: {
        Row: {
          id: string;
          organization_id: string;
          property_id: string | null;
          actor_type: string;
          actor_id: string | null;
          action: string;
          entity_type: string;
          entity_id: string;
          before_json: Json | null;
          after_json: Json | null;
          request_id: string;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["audit_logs"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["audit_logs"]["Row"]>;
        Relationships: [];
      };
      automation_rules: {
        Row: {
          id: string;
          organization_id: string;
          property_id: string;
          name: string;
          trigger: string;
          action: string;
          enabled: boolean;
        };
        Insert: Partial<
          Database["public"]["Tables"]["automation_rules"]["Row"]
        >;
        Update: Partial<
          Database["public"]["Tables"]["automation_rules"]["Row"]
        >;
        Relationships: [];
      };
      automation_runs: {
        Row: {
          id: string;
          organization_id: string;
          property_id: string;
          rule_id: string;
          event_id: string;
          status: string;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["automation_runs"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["automation_runs"]["Row"]>;
        Relationships: [];
      };
      channel_connections: {
        Row: {
          id: string;
          organization_id: string;
          property_id: string;
          provider: string;
          name: string;
          status: string;
          sync_mode: string;
          field_ownership: string;
          last_sync: string | null;
          last_error_code: string | null;
          version: number;
        };
        Insert: Partial<
          Database["public"]["Tables"]["channel_connections"]["Row"]
        >;
        Update: Partial<
          Database["public"]["Tables"]["channel_connections"]["Row"]
        >;
        Relationships: [];
      };
      channel_mappings: {
        Row: {
          id: string;
          organization_id: string;
          property_id: string;
          connection_id: string;
          inventory_type_id: string;
          rate_plan_id: string;
          external_id: string;
        };
        Insert: Partial<
          Database["public"]["Tables"]["channel_mappings"]["Row"]
        >;
        Update: Partial<
          Database["public"]["Tables"]["channel_mappings"]["Row"]
        >;
        Relationships: [];
      };
      conversations: {
        Row: {
          id: string;
          organization_id: string;
          property_id: string;
          reservation_id: string;
          status: string;
          assignee_id: string | null;
          version: number;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["conversations"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["conversations"]["Row"]>;
        Relationships: [];
      };
      external_identities: {
        Row: {
          organization_id: string;
          connection_id: string;
          provider: string;
          external_type: string;
          external_id: string;
          internal_id: string;
        };
        Insert: Partial<
          Database["public"]["Tables"]["external_identities"]["Row"]
        >;
        Update: Partial<
          Database["public"]["Tables"]["external_identities"]["Row"]
        >;
        Relationships: [];
      };
      folio_items: {
        Row: {
          id: string;
          organization_id: string;
          property_id: string;
          folio_id: string;
          type: string;
          description: string;
          quantity: number;
          unit_amount_minor: number;
          tax_minor: number;
          total_minor: number;
          service_date: string;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["folio_items"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["folio_items"]["Row"]>;
        Relationships: [];
      };
      folios: {
        Row: {
          id: string;
          organization_id: string;
          property_id: string;
          reservation_id: string;
          status: string;
          currency: string;
          opened_at: string;
          closed_at: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["folios"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["folios"]["Row"]>;
        Relationships: [];
      };
      guests: {
        Row: {
          id: string;
          organization_id: string;
          first_name: string;
          last_name: string;
          email: string | null;
          phone_e164: string | null;
          country_code: string | null;
          notes: string;
          pii_classification: string;
          version: number;
          created_by: string | null;
          company: string;
          address: string;
          city: string;
          region: string;
          postal_code: string;
          language: string;
        };
        Insert: Partial<Database["public"]["Tables"]["guests"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["guests"]["Row"]>;
        Relationships: [];
      };
      ical_events: {
        Row: {
          id: string;
          organization_id: string;
          property_id: string;
          unit_id: string;
          provider: string;
          source_calendar: string;
          uid: string;
          sequence: number;
          source_stamp: string;
          fingerprint: string;
          block_id: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["ical_events"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["ical_events"]["Row"]>;
        Relationships: [];
      };
      ical_feeds: {
        Row: {
          id: string;
          organization_id: string;
          property_id: string;
          unit_id: string;
          token_hash: string;
          created_by: string;
          revoked_at: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["ical_feeds"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["ical_feeds"]["Row"]>;
        Relationships: [];
      };
      idempotency_keys: {
        Row: {
          organization_id: string;
          actor_id: string;
          key: string;
          fingerprint: string;
          response: Json | null;
          created_at: string;
        };
        Insert: Partial<
          Database["public"]["Tables"]["idempotency_keys"]["Row"]
        >;
        Update: Partial<
          Database["public"]["Tables"]["idempotency_keys"]["Row"]
        >;
        Relationships: [];
      };
      inventory_blocks: {
        Row: {
          id: string;
          organization_id: string;
          property_id: string;
          unit_id: string;
          start_date: string;
          end_date: string;
          reason: string;
          status: string;
        };
        Insert: Partial<
          Database["public"]["Tables"]["inventory_blocks"]["Row"]
        >;
        Update: Partial<
          Database["public"]["Tables"]["inventory_blocks"]["Row"]
        >;
        Relationships: [];
      };
      inventory_day: {
        Row: {
          organization_id: string;
          property_id: string;
          inventory_type_id: string;
          stay_date: string;
          physical_capacity: number;
          held: number;
          sold: number;
          out_of_service: number;
          adjustment: number;
          sellable: number | null;
          version: number;
        };
        Insert: Partial<Database["public"]["Tables"]["inventory_day"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["inventory_day"]["Row"]>;
        Relationships: [];
      };
      inventory_relations: {
        Row: {
          organization_id: string;
          property_id: string;
          parent_unit_id: string;
          child_unit_id: string;
          relation_type: string;
          quantity: number;
        };
        Insert: Partial<
          Database["public"]["Tables"]["inventory_relations"]["Row"]
        >;
        Update: Partial<
          Database["public"]["Tables"]["inventory_relations"]["Row"]
        >;
        Relationships: [];
      };
      inventory_types: {
        Row: {
          id: string;
          organization_id: string;
          property_id: string;
          name: string;
          code: string | null;
          sell_mode: string;
          max_occupancy: number;
          base_rate_minor: number;
          active: boolean;
          sort_order: number;
        };
        Insert: Partial<Database["public"]["Tables"]["inventory_types"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["inventory_types"]["Row"]>;
        Relationships: [];
      };
      jobs: {
        Row: {
          id: string;
          organization_id: string;
          property_id: string;
          actor_id: string;
          type: string;
          status: string;
          step: number;
          progress: number;
          payload: Json;
          attempts: number;
          max_attempts: number;
          run_after: string;
          locked_until: string | null;
          lock_token: string | null;
          last_error_code: string | null;
          result: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["jobs"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["jobs"]["Row"]>;
        Relationships: [];
      };
      market_observations: {
        Row: {
          id: string;
          organization_id: string;
          property_id: string;
          stay_date: string;
          observed_on: string;
          source: string;
          market: string;
          currency: string;
          adr_minor: number;
          occupancy_bps: number;
          sample_size: number;
        };
        Insert: Partial<
          Database["public"]["Tables"]["market_observations"]["Row"]
        >;
        Update: Partial<
          Database["public"]["Tables"]["market_observations"]["Row"]
        >;
        Relationships: [];
      };
      member_property_scopes: {
        Row: {
          organization_id: string;
          user_id: string;
          property_id: string;
        };
        Insert: Partial<
          Database["public"]["Tables"]["member_property_scopes"]["Row"]
        >;
        Update: Partial<
          Database["public"]["Tables"]["member_property_scopes"]["Row"]
        >;
        Relationships: [];
      };
      message_entries: {
        Row: {
          id: string;
          organization_id: string;
          property_id: string;
          reservation_id: string;
          direction: string;
          status: string;
          subject: string;
          body: string;
          scheduled_at: string | null;
          failure_code: string | null;
          author_id: string;
          created_at: string;
          version: number;
        };
        Insert: Partial<Database["public"]["Tables"]["message_entries"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["message_entries"]["Row"]>;
        Relationships: [];
      };
      message_templates: {
        Row: {
          id: string;
          organization_id: string;
          property_id: string;
          name: string;
          locale: string;
          subject: string;
          body: string;
          trigger: string;
          offset_days: number;
          version: number;
        };
        Insert: Partial<
          Database["public"]["Tables"]["message_templates"]["Row"]
        >;
        Update: Partial<
          Database["public"]["Tables"]["message_templates"]["Row"]
        >;
        Relationships: [];
      };
      migration_conflicts: {
        Row: {
          id: string;
          organization_id: string;
          property_id: string;
          job_id: string;
          record_id: string;
          code: string;
          resolution: string | null;
        };
        Insert: Partial<
          Database["public"]["Tables"]["migration_conflicts"]["Row"]
        >;
        Update: Partial<
          Database["public"]["Tables"]["migration_conflicts"]["Row"]
        >;
        Relationships: [];
      };
      migration_records: {
        Row: {
          id: string;
          organization_id: string;
          property_id: string;
          job_id: string;
          provider: string;
          external_id: string;
          external_updated_at: string | null;
          fingerprint: string;
          canonical_type: string;
          canonical_payload: Json;
          status: string;
          error_code: string | null;
        };
        Insert: Partial<
          Database["public"]["Tables"]["migration_records"]["Row"]
        >;
        Update: Partial<
          Database["public"]["Tables"]["migration_records"]["Row"]
        >;
        Relationships: [];
      };
      onboarding_drafts: {
        Row: {
          id: string;
          organization_id: string;
          user_id: string;
          step: number;
          data: Json;
          updated_at: string;
        };
        Insert: Partial<
          Database["public"]["Tables"]["onboarding_drafts"]["Row"]
        >;
        Update: Partial<
          Database["public"]["Tables"]["onboarding_drafts"]["Row"]
        >;
        Relationships: [];
      };
      organization_members: {
        Row: {
          organization_id: string;
          user_id: string;
          role_id: string;
          status: string;
          all_properties: boolean;
          invited_by: string | null;
          joined_at: string;
        };
        Insert: Partial<
          Database["public"]["Tables"]["organization_members"]["Row"]
        >;
        Update: Partial<
          Database["public"]["Tables"]["organization_members"]["Row"]
        >;
        Relationships: [];
      };
      organizations: {
        Row: {
          id: string;
          name: string;
          slug: string | null;
          default_currency: string;
          default_timezone: string;
          status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["organizations"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["organizations"]["Row"]>;
        Relationships: [];
      };
      outbox_events: {
        Row: {
          id: string;
          organization_id: string;
          property_id: string;
          type: string;
          entity_id: string;
          payload: Json;
          created_at: string;
          processed_at: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["outbox_events"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["outbox_events"]["Row"]>;
        Relationships: [];
      };
      payments: {
        Row: {
          id: string;
          organization_id: string;
          property_id: string;
          reservation_id: string;
          provider: string;
          provider_payment_id: string;
          amount_minor: number;
          currency: string;
          status: string;
          method_type: string;
          received_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["payments"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["payments"]["Row"]>;
        Relationships: [];
      };
      permissions: {
        Row: {
          key: string;
          description: string;
        };
        Insert: Partial<Database["public"]["Tables"]["permissions"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["permissions"]["Row"]>;
        Relationships: [];
      };
      properties: {
        Row: {
          id: string;
          organization_id: string;
          name: string;
          concept: string;
          timezone: string;
          currency: string;
          country_code: string;
          city: string;
          address: string;
          status: string;
          onboarding_state: Json;
          version: number;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["properties"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["properties"]["Row"]>;
        Relationships: [];
      };
      property_amenities: {
        Row: {
          organization_id: string;
          property_id: string;
          amenity_id: string;
          metadata: Json;
        };
        Insert: Partial<
          Database["public"]["Tables"]["property_amenities"]["Row"]
        >;
        Update: Partial<
          Database["public"]["Tables"]["property_amenities"]["Row"]
        >;
        Relationships: [];
      };
      property_settings: {
        Row: {
          property_id: string;
          organization_id: string;
          check_in_from: string;
          check_out_until: string;
          locale: string;
          allowed_overbooking: number;
          tax_bps: number;
          policy: string;
          settings_json: Json;
        };
        Insert: Partial<
          Database["public"]["Tables"]["property_settings"]["Row"]
        >;
        Update: Partial<
          Database["public"]["Tables"]["property_settings"]["Row"]
        >;
        Relationships: [];
      };
      rate_day: {
        Row: {
          id: string;
          organization_id: string;
          property_id: string;
          rate_plan_id: string;
          inventory_type_id: string;
          stay_date: string;
          occupancy_key: string;
          amount_minor: number;
          currency: string;
          min_stay: number;
          max_stay: number;
          closed: boolean;
          cta: boolean;
          ctd: boolean;
          version: number;
        };
        Insert: Partial<Database["public"]["Tables"]["rate_day"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["rate_day"]["Row"]>;
        Relationships: [];
      };
      rate_plans: {
        Row: {
          id: string;
          organization_id: string;
          property_id: string;
          name: string;
          parent_rate_plan_id: string | null;
          active: boolean;
        };
        Insert: Partial<Database["public"]["Tables"]["rate_plans"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["rate_plans"]["Row"]>;
        Relationships: [];
      };
      raw_provider_events: {
        Row: {
          id: string;
          organization_id: string;
          receipt_id: string;
          redacted_payload: Json;
          expires_at: string;
        };
        Insert: Partial<
          Database["public"]["Tables"]["raw_provider_events"]["Row"]
        >;
        Update: Partial<
          Database["public"]["Tables"]["raw_provider_events"]["Row"]
        >;
        Relationships: [];
      };
      reservation_guests: {
        Row: {
          organization_id: string;
          property_id: string;
          reservation_id: string;
          guest_id: string;
          is_primary: boolean;
        };
        Insert: Partial<
          Database["public"]["Tables"]["reservation_guests"]["Row"]
        >;
        Update: Partial<
          Database["public"]["Tables"]["reservation_guests"]["Row"]
        >;
        Relationships: [];
      };
      reservation_notes: {
        Row: {
          id: string;
          organization_id: string;
          property_id: string;
          reservation_id: string;
          author_user_id: string;
          body: string;
          visibility: string;
          created_at: string;
        };
        Insert: Partial<
          Database["public"]["Tables"]["reservation_notes"]["Row"]
        >;
        Update: Partial<
          Database["public"]["Tables"]["reservation_notes"]["Row"]
        >;
        Relationships: [];
      };
      reservation_units: {
        Row: {
          id: string;
          organization_id: string;
          property_id: string;
          reservation_id: string;
          inventory_type_id: string;
          unit_id: string | null;
          rate_plan_id: string;
          arrival_date: string;
          departure_date: string;
          guests_count: number;
        };
        Insert: Partial<
          Database["public"]["Tables"]["reservation_units"]["Row"]
        >;
        Update: Partial<
          Database["public"]["Tables"]["reservation_units"]["Row"]
        >;
        Relationships: [];
      };
      reservations: {
        Row: {
          id: string;
          organization_id: string;
          property_id: string;
          guest_id: string;
          confirmation_code: string;
          arrival_date: string;
          departure_date: string;
          adults: number;
          children: number;
          status: string;
          source: string;
          currency: string;
          total_minor: number;
          version: number;
          booked_at: string;
          cancelled_at: string | null;
          notes: string;
        };
        Insert: Partial<Database["public"]["Tables"]["reservations"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["reservations"]["Row"]>;
        Relationships: [];
      };
      role_permissions: {
        Row: {
          role_id: string;
          permission_key: string;
        };
        Insert: Partial<
          Database["public"]["Tables"]["role_permissions"]["Row"]
        >;
        Update: Partial<
          Database["public"]["Tables"]["role_permissions"]["Row"]
        >;
        Relationships: [];
      };
      roles: {
        Row: {
          id: string;
          organization_id: string | null;
          key: string;
          name: string;
          is_system: boolean;
        };
        Insert: Partial<Database["public"]["Tables"]["roles"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["roles"]["Row"]>;
        Relationships: [];
      };
      tasks: {
        Row: {
          id: string;
          organization_id: string;
          property_id: string;
          unit_id: string | null;
          kind: string;
          title: string;
          status: string;
          priority: string;
          assignee_id: string | null;
          version: number;
        };
        Insert: Partial<Database["public"]["Tables"]["tasks"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["tasks"]["Row"]>;
        Relationships: [];
      };
      unit_attributes: {
        Row: {
          unit_id: string;
          key: string;
          value_json: Json;
        };
        Insert: Partial<Database["public"]["Tables"]["unit_attributes"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["unit_attributes"]["Row"]>;
        Relationships: [];
      };
      units: {
        Row: {
          id: string;
          organization_id: string;
          property_id: string;
          inventory_type_id: string;
          name: string;
          parent_unit_id: string | null;
          active: boolean;
          housekeeping_status: string;
          version: number;
        };
        Insert: Partial<Database["public"]["Tables"]["units"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["units"]["Row"]>;
        Relationships: [];
      };
      webhook_receipts: {
        Row: {
          id: string;
          organization_id: string;
          provider: string;
          connection_id: string;
          provider_event_id: string;
          fingerprint: string;
          received_at: string;
          status: string;
        };
        Insert: Partial<
          Database["public"]["Tables"]["webhook_receipts"]["Row"]
        >;
        Update: Partial<
          Database["public"]["Tables"]["webhook_receipts"]["Row"]
        >;
        Relationships: [];
      };
      workspace_preferences: {
        Row: {
          id: string;
          organization_id: string;
          user_id: string;
          preferences: Json;
          version: number;
          updated_at: string;
        };
        Insert: Partial<
          Database["public"]["Tables"]["workspace_preferences"]["Row"]
        >;
        Update: Partial<
          Database["public"]["Tables"]["workspace_preferences"]["Row"]
        >;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      pms_reservations: { Args: { org: string; prop: string }; Returns: Json };
      pms_public_calendar: { Args: { token: string }; Returns: Json };
      pms_team: { Args: { org: string }; Returns: Json };
      pms_command: {
        Args: { command: Json; idempotency_key: string };
        Returns: Json;
      };
      pms_save_reservation: {
        Args: { command: Json; idempotency_key: string };
        Returns: Json;
      };
      pms_transition_reservation: {
        Args: { command: Json; idempotency_key: string };
        Returns: Json;
      };
      pms_block_unit: {
        Args: { command: Json; idempotency_key: string };
        Returns: Json;
      };
      pms_claim_job: {
        Args: { worker_id: string };
        Returns: Database["public"]["Tables"]["jobs"]["Row"][];
      };
      pms_finish_job: {
        Args: {
          job_id: string;
          worker_id: string;
          succeeded: boolean;
          error_code?: string;
        };
        Returns: boolean;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
