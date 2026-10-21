package com.calishealth.config;

import javax.sql.DataSource;
import org.flywaydb.core.Flyway;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.config.ConfigurableListableBeanFactory;
import org.springframework.beans.factory.support.BeanDefinitionRegistry;
import org.springframework.beans.factory.support.BeanDefinitionRegistryPostProcessor;
import org.springframework.beans.factory.support.RootBeanDefinition;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Spring Boot 4 removed Flyway auto-configuration from spring-boot-autoconfigure
 * (verified: spring-boot-autoconfigure-4.1.1.jar contains no Flyway classes).
 *
 * So the Flyway bean must be registered manually.
 *
 * INIT ORDER (important):
 *   Spring does NOT guarantee that EntityManagerFactory (JPA) waits for Flyway.
 *   If JPA starts first, Hibernate validates against an empty schema and fails
 *   with "missing table [xxx]".
 *   The BeanDefinitionRegistryPostProcessor below sets dependsOn("flyway") on the
 *   entityManagerFactory bean definition, forcing JPA to wait for migrate().
 *
 * The flyway bean uses initMethod="migrate", so migrations run at application
 * startup, BEFORE Tomcat accepts requests.
 *
 * application.yml must set:
 *   spring.jpa.hibernate.ddl-auto: none   (Flyway is the single source of truth)
 *
 * Set spring.flyway.enabled=false to disable this bean (used by the test profile).
 */
@Configuration
@ConditionalOnProperty(name = "spring.flyway.enabled", havingValue = "true", matchIfMissing = true)
public class FlywayConfig {

    private static final Logger log = LoggerFactory.getLogger(FlywayConfig.class);

    @Bean
    public static BeanDefinitionRegistryPostProcessor jpaDependsOnFlyway() {
        return new BeanDefinitionRegistryPostProcessor() {
            @Override
            public void postProcessBeanDefinitionRegistry(BeanDefinitionRegistry registry) {
                for (String name : registry.getBeanDefinitionNames()) {
                    if (name.startsWith("entityManagerFactory")) {
                        RootBeanDefinition def = (RootBeanDefinition) registry.getBeanDefinition(name);
                        def.setDependsOn(new String[] { "flyway" });
                        log.info("Bean '{}' dependsOn flyway: migrate runs before JPA", name);
                    }
                }
            }

            @Override
            public void postProcessBeanFactory(ConfigurableListableBeanFactory beanFactory) {
                // no-op
            }
        };
    }

    @Bean(initMethod = "migrate")
    public Flyway flyway(DataSource dataSource) {
        // baselineOnMigrate(false): on an empty DB, V1 just runs normally.
        // baselineOnMigrate(true) + baselineVersion("0") makes Flyway record a
        // baseline at version 0 and then still apply V1 -> "Table already exists".
        Flyway fw = Flyway.configure()
                .dataSource(dataSource)
                .locations("classpath:db/migration")
                .baselineOnMigrate(false)
                .validateOnMigrate(true)
                .cleanDisabled(true)
                .load();
        log.info("Flyway configured: locations=classpath:db/migration");
        return fw;
    }
}
