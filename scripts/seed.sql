INSERT INTO anchorages (name, latitude, longitude, depth, bottom_type, description) VALUES
('Gocek Bay',      36.7547, 28.9273, 8.5, 'mud',  'Protected bay with calm overnight conditions.'),
('Oludeniz',       36.5461, 29.1228, 5.0, 'sand', 'Popular anchorage with scenic lagoon views.'),
('Bozburun',       36.6731, 28.0547, 6.0, 'sand', 'Quiet stop with good shelter from northerlies.'),
('Datca Harbor',   36.7139, 27.6881, 4.5, 'mud',  'Harbor area with nearby provisioning options.'),
('Bodrum Harbor',  37.0344, 27.4305, 7.0, 'rock', 'Busy marina zone with full marine services.'),
('Marmaris',       36.8552, 28.2720, 9.0, 'mud',  'Large yachting hub and common transit stop.'),
('Kekova',         36.1891, 29.8386, 6.5, 'sand', 'Historic bay area with attractive water clarity.'),
('Kas',            36.2014, 29.6432, 8.0, 'rock', 'Good stopover near dive sites and town access.'),
('Fethiye',        36.6553, 29.1085, 7.5, 'mud',  'Main gulf gateway with extensive facilities.'),
('Gobun Bay',      36.7712, 28.0234, 5.5, 'sand', 'Sheltered cove suited for short overnight stays.')
ON CONFLICT DO NOTHING;
