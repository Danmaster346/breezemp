drop policy if exists review_reports_insert_own on public.review_reports;
create policy review_reports_insert_own on public.review_reports
for insert to authenticated
with check (
  auth.uid() = reporter_id
  and status = 'pending'
  and resolved_by is null
  and resolved_at is null
);