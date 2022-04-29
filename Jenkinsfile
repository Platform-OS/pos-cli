@Library('pipeline-utils')_

def name = 'pos-cli'

pipeline {
  agent any

  environment {
    PROJECT_NAME = "${env.BRANCH_NAME}-${env.GIT_COMMIT[0..5]}-${env.BUILD_ID}"
    MPKIT_TOKEN = credentials('POS_TOKEN')
    MPKIT_EMAIL = "darek+ci@near-me.com"
    MPKIT_URL = "https://qa-17263.staging.oregon.platform-os.com"
  }

  stages {
    stage('Test') {
      agent { docker { image "node:16-alpine" } }

      steps {
        sh 'npm ci'
        sh 'npm test'
      }
    }

    stage('Build') {
      when { branch 'master' }
      steps {
        script {
          docker.withRegistry('https://registry.hub.docker.com', 'posops-dockerhub') {
            def image = docker.build("platformos/${name}")
            image.push()
          }
        }
      }
    }

    stage('Build testcafe-pos-cli') {
      when { branch 'master' }
      steps {
        build job: 'platformOS/toolbelt/master/', parameters: [
          string(name: 'force', value: 'testcafe-pos-cli')
        ], quietPeriod: 0
      }
    }
  }
  post {
    success {
      notify("${name}-pipeline ${env.PROJECT_NAME} Success after ${buildDuration()}.")
    }

    failure {
      alert("${name}-pipeline ${env.PROJECT_NAME} Failed after ${buildDuration()}.")
    }
  }
}
