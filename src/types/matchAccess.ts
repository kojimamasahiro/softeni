import type { Match } from './database';

type CommonMatchInputTeam = NonNullable<Match['teams']>;

export interface CommonMatchInput {
  tournament_name: Match['tournament_name'];
  tournament_id: Match['tournament_id'];
  tournament_generation: Match['tournament_generation'];
  tournament_gender: Match['tournament_gender'];
  tournament_category: Match['tournament_category'];
  tournament_year?: Match['tournament_year'];
  round_name: Match['round_name'];
  best_of: Match['best_of'];
  game_type?: Match['game_type'];
  match_date?: Match['match_date'];
  court_name?: Match['court_name'];
  status?: Match['status'];
  team_a: Match['team_a'];
  team_b: Match['team_b'];
  teams?: CommonMatchInputTeam;
  team_a_entry_number?: Match['team_a_entry_number'];
  team_b_entry_number?: Match['team_b_entry_number'];
  team_a_player1_last_name?: Match['team_a_player1_last_name'];
  team_a_player1_first_name?: Match['team_a_player1_first_name'];
  team_a_player1_team_name?: Match['team_a_player1_team_name'];
  team_a_player1_region?: Match['team_a_player1_region'];
  team_a_player2_last_name?: Match['team_a_player2_last_name'];
  team_a_player2_first_name?: Match['team_a_player2_first_name'];
  team_a_player2_team_name?: Match['team_a_player2_team_name'];
  team_a_player2_region?: Match['team_a_player2_region'];
  team_b_player1_last_name?: Match['team_b_player1_last_name'];
  team_b_player1_first_name?: Match['team_b_player1_first_name'];
  team_b_player1_team_name?: Match['team_b_player1_team_name'];
  team_b_player1_region?: Match['team_b_player1_region'];
  team_b_player2_last_name?: Match['team_b_player2_last_name'];
  team_b_player2_first_name?: Match['team_b_player2_first_name'];
  team_b_player2_team_name?: Match['team_b_player2_team_name'];
  team_b_player2_region?: Match['team_b_player2_region'];
}

export interface SofteniPickMatchInput extends CommonMatchInput {
  opponent_level?: Match['opponent_level'];
  source_site_match_id?: Match['source_site_match_id'];
  source_site_tournament_id?: Match['source_site_tournament_id'];
}

export type PublicMatchSnapshot = Omit<
  Match,
  'source_site_match_id' | 'source_site_tournament_id'
>;
