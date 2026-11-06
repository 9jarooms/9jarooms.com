-- Round 3 hid owner_id/caretaker_id from the public role; policies that read those columns must not
-- run for it, or every public read of rooms fails.
alter policy caretakers_read_rooms on rooms to authenticated;
alter policy owners_read_owned_rooms on rooms to authenticated;
