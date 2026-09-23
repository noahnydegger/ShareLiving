BEGIN;

ALTER TABLE public.houses DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.living_groups DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.people DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.guest_rooms DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.chores DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.defects DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.laundry_bookings DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.food_entries DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.food_meal_settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.guestroom_bookings DISABLE ROW LEVEL SECURITY;

GRANT ALL PRIVILEGES ON TABLE
    public.houses,
    public.living_groups,
    public.people,
    public.guest_rooms,
    public.chores,
    public.defects,
    public.feedback,
    public.users,
    public.laundry_bookings,
    public.food_entries,
    public.food_meal_settings,
    public.guestroom_bookings
TO anon, authenticated;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public
TO anon, authenticated;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
GRANT ALL PRIVILEGES ON TABLES TO anon, authenticated;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
GRANT USAGE, SELECT ON SEQUENCES TO anon, authenticated;

COMMIT;
