-- Time Slots
                                           Table "public.time_slots"
       Column       |           Type           | Collation | Nullable |                Default                 
--------------------+--------------------------+-----------+----------+----------------------------------------
 id                 | integer                  |           | not null | nextval('time_slots_id_seq'::regclass)
 start_time         | timestamp with time zone |           | not null | 
 end_time           | timestamp with time zone |           | not null | 
 price              | real                     |           | not null | 
 status             | text                     |           | not null | 'available'::text
 reservation_expiry | timestamp with time zone |           |          | 
 storage_timezone   | text                     |           | not null | 'UTC'::text
Indexes:
    "time_slots_pkey" PRIMARY KEY, btree (id)

  id  |       start_time       |        end_time        | price |  status   | reservation_expiry | storage_timezone 
------+------------------------+------------------------+-------+-----------+--------------------+------------------
 5667 | 2025-06-01 07:00:00+00 | 2025-06-01 07:30:00+00 |    20 | available |                    | UTC
 5668 | 2025-06-01 07:30:00+00 | 2025-06-01 08:00:00+00 |    20 | available |                    | UTC
 5669 | 2025-06-01 08:00:00+00 | 2025-06-01 08:30:00+00 |    20 | available |                    | UTC
 5670 | 2025-06-01 08:30:00+00 | 2025-06-01 09:00:00+00 |    20 | available |                    | UTC
 5671 | 2025-06-01 09:00:00+00 | 2025-06-01 09:30:00+00 |    20 | available |                    | UTC
 5672 | 2025-06-01 09:30:00+00 | 2025-06-01 10:00:00+00 |    20 | available |                    | UTC
 5673 | 2025-06-01 10:00:00+00 | 2025-06-01 10:30:00+00 |    20 | available |                    | UTC
 5674 | 2025-06-01 10:30:00+00 | 2025-06-01 11:00:00+00 |    20 | available |                    | UTC
 5675 | 2025-06-01 11:00:00+00 | 2025-06-01 11:30:00+00 |    20 | booked    |                    | UTC
 5676 | 2025-06-01 11:30:00+00 | 2025-06-01 12:00:00+00 |    20 | booked    |                    | UTC
 5677 | 2025-06-01 12:00:00+00 | 2025-06-01 12:30:00+00 |    20 | booked    |                    | UTC
 5678 | 2025-06-01 12:30:00+00 | 2025-06-01 13:00:00+00 |    20 | booked    |                    | UTC
 5679 | 2025-06-01 13:00:00+00 | 2025-06-01 13:30:00+00 |    20 | booked    |                    | UTC
 5680 | 2025-06-01 13:30:00+00 | 2025-06-01 14:00:00+00 |    20 | booked    |                    | UTC
 5681 | 2025-06-01 14:00:00+00 | 2025-06-01 14:30:00+00 |    20 | available |                    | UTC
 5682 | 2025-06-01 14:30:00+00 | 2025-06-01 15:00:00+00 |    20 | available |                    | UTC
 5683 | 2025-06-01 15:00:00+00 | 2025-06-01 15:30:00+00 |    20 | available |                    | UTC
 5684 | 2025-06-01 15:30:00+00 | 2025-06-01 16:00:00+00 |    20 | available |                    | UTC
 5685 | 2025-06-01 16:00:00+00 | 2025-06-01 16:30:00+00 |    20 | available |                    | UTC
 5686 | 2025-06-01 16:30:00+00 | 2025-06-01 17:00:00+00 |    20 | available |                    | UTC
 5687 | 2025-06-01 17:00:00+00 | 2025-06-01 17:30:00+00 |    20 | available |                    | UTC
 5688 | 2025-06-01 17:30:00+00 | 2025-06-01 18:00:00+00 |    20 | available |                    | UTC
(22 rows)


-- Bookings
                                           Table "public.bookings"
      Column      |            Type             | Collation | Nullable |               Default                
------------------+-----------------------------+-----------+----------+--------------------------------------
 id               | integer                     |           | not null | nextval('bookings_id_seq'::regclass)
 customer_name    | text                        |           | not null | 
 phone_number     | text                        |           | not null | 
 experience_level | text                        |           |          | 
 equipment_rental | boolean                     |           | not null | false
 created_at       | timestamp without time zone |           | not null | now()
 reference        | text                        |           | not null | 
 email            | text                        |           |          | 
 notes            | text                        |           |          | 
Indexes:
    "bookings_pkey" PRIMARY KEY, btree (id)

 id | customer_name | phone_number | experience_level | equipment_rental |       created_at        |  reference  |      email      | notes 
----+---------------+--------------+------------------+------------------+-------------------------+-------------+-----------------+-------
 30 | Baiba         | 29195934     |                  | f                | 2025-05-12 06:35:24.327 | WB-L_7LG1SG | admin@hiwake.lv | 
(1 row)


-- Booking-Time Slots Join Table
                               Table "public.booking_time_slots"
    Column    |  Type   | Collation | Nullable |                    Default                     
--------------+---------+-----------+----------+------------------------------------------------
 id           | integer |           | not null | nextval('booking_time_slots_id_seq'::regclass)
 booking_id   | integer |           | not null | 
 time_slot_id | integer |           | not null | 
Indexes:
    "booking_time_slots_pkey" PRIMARY KEY, btree (id)

 id | booking_id | time_slot_id 
----+------------+--------------
 84 |         30 |         5677
 86 |         30 |         5678
 87 |         30 |         5675
 85 |         30 |         5680
 83 |         30 |         5679
 88 |         30 |         5676
(6 rows)

