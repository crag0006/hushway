from app.services.profile import CountProfile


def test_returns_count_for_known_sensor():
    assert CountProfile({1: 300}).count_for(1) == 300


def test_returns_none_for_sensor_without_data():
    assert CountProfile({1: 300}).count_for(99) is None


def test_has_data_reflects_membership():
    profile = CountProfile({1: 300})
    assert profile.has_data(1) is True
    assert profile.has_data(99) is False


def test_empty_profile_returns_none():
    assert CountProfile({}).count_for(1) is None
