import java.sql.*;

public class TestDB {
    public static void main(String[] args) throws Exception {
        Class.forName("com.mysql.cj.jdbc.Driver");
        Connection conn = DriverManager.getConnection(
            "jdbc:mysql://localhost:3306/calishealth",
            "root", "12345678"
        );
        
        Statement stmt = conn.createStatement();
        
        // Check fitness_levels
        System.out.println("=== Fitness Levels ===");
        ResultSet rs = stmt.executeQuery(
            "SELECT id, name, status, score_min, score_max, sort_order FROM fitness_levels"
        );
        while (rs.next()) {
            System.out.printf("  ID=%d, Name=%s, Status=%s, Score=%d-%d, Sort=%d\n",
                rs.getInt("id"), rs.getString("name"), rs.getString("status"),
                rs.getInt("score_min"), rs.getInt("score_max"), rs.getInt("sort_order"));
        }
        
        // Check users
        System.out.println("\n=== Users (First 5) ===");
        rs = stmt.executeQuery("SELECT id, email, role FROM users LIMIT 5");
        while (rs.next()) {
            System.out.printf("  ID=%d, Email=%s, Role=%s\n",
                rs.getInt("id"), rs.getString("email"), rs.getString("role"));
        }
        
        // Check surveys
        System.out.println("\n=== Surveys ===");
        rs = stmt.executeQuery("SELECT id, survey_code, survey_name, status FROM surveys");
        while (rs.next()) {
            System.out.printf("  ID=%d, Code=%s, Name=%s, Status=%s\n",
                rs.getInt("id"), rs.getString("survey_code"), rs.getString("survey_name"), rs.getString("status"));
        }
        
        conn.close();
        System.out.println("\n✓ Database check complete");
    }
}
